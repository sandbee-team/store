"use strict";
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
function emailLayout({
  subject,
  title,
  description,
  content = "",
  url,
  action,
  footer,
}) {
  return (
    '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>' +
    escape(subject) +
    '</title></head><body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#20242b"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:40px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px"><tr><td style="padding:0 0 24px;font-size:21px;font-weight:700">sandbee<span style="font-weight:400;color:#616974;font-size:14px"> / store</span></td></tr><tr><td style="background:#fff;padding:32px;border:1px solid #dde1e7;border-radius:8px"><h1 style="font-size:22px;line-height:1.35;margin:0 0 14px">' +
    escape(title) +
    '</h1><p style="font-size:14px;line-height:1.7;color:#4d5663;margin:0 0 24px">' +
    escape(description) +
    "</p>" +
    content +
    '<p style="margin:24px 0"><a href="' +
    escape(url) +
    '" style="display:inline-block;background:#2459c4;border-radius:5px;padding:12px 18px;color:#fff;text-decoration:none;font-size:14px;font-weight:600">' +
    escape(action) +
    '</a></p><p style="font-size:12px;line-height:1.7;color:#616974;border-top:1px solid #e4e7eb;padding-top:20px;margin-bottom:0">' +
    escape(footer) +
    '</p></td></tr><tr><td style="padding-top:20px;font-size:12px;color:#616974">Sandbee Store / Account and workspace notifications</td></tr></table></td></tr></table></body></html>'
  );
}
function renderEmail({ purpose, code, appUrl }) {
  if (purpose !== "changed" && !/^\d{6}$/.test(code))
    throw new Error("Invalid email code");
  const changed = purpose === "changed",
    reset = purpose === "reset";
  const title = changed
    ? "Password updated"
    : reset
      ? "Reset your password"
      : "Verify your email";
  const subject = changed
    ? "Password changed | Sandbee Store"
    : reset
      ? "Your password reset code | Sandbee Store"
      : "Verify your email | Sandbee Store";
  const description = changed
    ? "Your password was changed. Previous sessions and API keys created by your account are no longer valid."
    : reset
      ? "Enter this code on the password recovery screen. It can be used once and expires in 10 minutes."
      : "Enter this code to verify your account and continue setting up your workspace.";
  const footer = changed
    ? "If you did not request this change, use Forgot password on the sign-in page to secure your account."
    : "Never share this code. If you did not request this email, you can ignore it.";
  return {
    subject,
    text:
      title +
      "\n\n" +
      description +
      "\n\n" +
      (changed ? "" : "Your code is " + code + ". Expires in 10 minutes.\n\n") +
      "Open your workspace: " +
      appUrl +
      "\n\n" +
      footer,
    html: emailLayout({
      subject,
      title,
      description,
      url: appUrl,
      action: "Open Sandbee Store",
      footer,
      content: changed
        ? ""
        : '<div style="background:#f2f5fc;border:1px solid #d6dfef;border-radius:5px;padding:20px;text-align:center;font-size:30px;font-weight:700;letter-spacing:6px;color:#20242b">' +
          code +
          "</div>",
    }),
  };
}
function renderInvitation({ workspace, inviter, role, appUrl }) {
  const subject = "Workspace invitation | Sandbee Store",
    title = "Join " + workspace;
  const description =
    inviter +
    " invited you to join " +
    workspace +
    " as " +
    role +
    ". Sign in with this email address, then review and accept the invitation. It expires in 7 days.";
  const url = appUrl + "/invitations",
    footer =
      "Access starts only after you accept. If this invitation was unexpected, you can ignore it.";
  return {
    subject,
    text:
      title +
      "\n\n" +
      description +
      "\n\nReview invitation: " +
      url +
      "\n\n" +
      footer,
    html: emailLayout({
      subject,
      title,
      description,
      url,
      action: "Review invitation",
      footer,
    }),
  };
}
module.exports = { renderEmail, renderInvitation };
