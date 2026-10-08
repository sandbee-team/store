param([string]$Destination)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $Destination) {
    $Destination = Join-Path (Split-Path $projectRoot -Parent) ('sandbee-store-source-' + (Get-Date -Format 'yyyy-MM-dd-HHmmss') + '.zip')
}
$archivePath = [System.IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $archivePath) { throw 'Destination already exists; choose a new filename.' }
foreach ($required in @('DESIGN.md', '.impeccable/design.json', 'docs/verification.md', 'docs/interface-review.md', 'docs/interface-review-polish.md', 'packages/ocr/vendor/doc-extractor/dist/index.js')) {
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $required))) { throw "Required delivery document missing: $required" }
}
$rootFiles = @('.dockerignore', '.env.example', '.gitattributes', '.gitignore', 'compose.production.yaml', 'compose.yaml', 'Dockerfile', 'package-lock.json', 'package.json', 'playwright.config.js', 'PRODUCT.md', 'DESIGN.md', 'README.md', 'server.js', 'vite.config.mjs')
$sourceDirectories = @('backend', 'deploy', 'docs', 'frontend', 'packages', 'scripts', 'services', 'test')
$skipDirectories = @('node_modules', 'dist', '__pycache__', '.venv', '.git', '.local', 'test-results', 'playwright-report')
# This vendored runtime is an input, not this project's generated build output.
$engineRuntime = [IO.Path]::GetFullPath((Join-Path $projectRoot 'packages/ocr/vendor/doc-extractor/dist'))
function Get-SourceFiles([string]$Directory) {
    foreach ($item in Get-ChildItem -LiteralPath $Directory -Force) {
        if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw "Symlink/junction requires explicit review: $($item.FullName)" }
        if ($item.PSIsContainer) {
            if ($item.Name -notin $skipDirectories -or $item.FullName -eq $engineRuntime) { Get-SourceFiles $item.FullName }
        } elseif (($item.Name -notlike '.env*' -or $item.Name -eq '.env.example') -and $item.Extension -notin @('.log', '.pem', '.key', '.pfx', '.pyc')) {
            $item
        }
    }
}
$files = @($rootFiles | ForEach-Object { Get-Item -LiteralPath (Join-Path $projectRoot $_) })
foreach ($directory in $sourceDirectories) { $files += @(Get-SourceFiles (Join-Path $projectRoot $directory)) }
$files += Get-Item -LiteralPath (Join-Path $projectRoot '.impeccable/design.json')
$files += @(Get-SourceFiles (Join-Path $projectRoot '.impeccable/surfaces'))
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::CreateNew)
$archive = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, ('sandbee-store/' + $relative), [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $archive.Dispose(); $stream.Dispose() }
$check = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    if ($check.Entries.Count -ne $files.Count) { throw 'Archive entry count mismatch.' }
    foreach ($entry in $check.Entries) {
        if ($entry.FullName -match '(^|/)(\.local|node_modules|\.agents|test-results)/|(^|/)\.env$|\.(pem|key|pfx)$') { throw "Excluded path found: $($entry.FullName)" }
        $relative = $entry.FullName.Substring('sandbee-store/'.Length)
        $sourcePath = Join-Path $projectRoot $relative
        $entryStream = $entry.Open()
        $entryHasher = [System.Security.Cryptography.SHA256]::Create()
        try { $entryHash = [System.BitConverter]::ToString($entryHasher.ComputeHash($entryStream)).Replace('-', '') }
        finally { $entryStream.Dispose(); $entryHasher.Dispose() }
        if ($entryHash -ne (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash) { throw "Archive content mismatch: $relative" }
    }
} finally { $check.Dispose() }
$hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText($archivePath + '.sha256', $hash + '  ' + [System.IO.Path]::GetFileName($archivePath) + [Environment]::NewLine)
[pscustomobject]@{ Archive = $archivePath; Files = $files.Count; Bytes = (Get-Item -LiteralPath $archivePath).Length; SHA256 = $hash } | ConvertTo-Json
