import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Fingerprint,
  ScanLine,
  Search,
  Grid2X2,
} from "lucide-react";
import { PageTitle, Button, Pill, Empty } from "../components/ui";
export default function Apps({ data, navigate }) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const groups = useMemo(() => {
    const apps = data.apps.filter(
      (app) =>
        (filter === "all" || app.enabled) &&
        `${app.name} ${app.category} ${app.mode}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    );
    return Object.entries(Object.groupBy(apps, (app) => app.category));
  }, [data.apps, filter, query]);
  return (
    <>
      <PageTitle title="Apps">Find a service and open its workspace.</PageTitle>
      <div className="catalog-toolbar">
        <div className="segmented" role="group" aria-label="App availability">
          <button
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All apps <span>{data.apps.length}</span>
          </button>
          <button
            aria-pressed={filter === "enabled"}
            onClick={() => setFilter("enabled")}
          >
            Enabled <span>{data.apps.filter((a) => a.enabled).length}</span>
          </button>
        </div>
        <label className="catalog-search">
          <Search size={15} />
          <span className="sr-only">Search apps</span>
          <input
            type="search"
            placeholder="Search apps"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {groups.length ? (
        <div className="app-groups">
          {groups.map(([category, apps]) => (
            <section className="app-category" key={category}>
              <h2>
                {category}
                <span>{apps.length}</span>
              </h2>
              <div className="app-cards">
                {apps.map((app) => {
                  const Icon = app.id === "gst" ? Fingerprint : ScanLine;
                  return (
                    <article className="catalog-card" key={app.id}>
                      <div className="catalog-card-top">
                        <span className="app-icon">
                          <Icon size={24} />
                        </span>
                        <Pill tone={app.enabled ? "green" : "neutral"}>
                          {app.enabled ? "Enabled" : "Not enabled"}
                        </Pill>
                      </div>
                      <a
                        className="catalog-name"
                        href={app.path}
                        onClick={(e) => {
                          if (!e.ctrlKey && !e.metaKey) {
                            e.preventDefault();
                            navigate(app.path);
                          }
                        }}
                      >
                        {app.name}
                      </a>
                      <p>{app.description}</p>
                      <div className="catalog-card-bottom">
                        <span>
                          {app.mode}{" "}
                          <Pill tone="neutral">{app.pricing.label}</Pill>
                        </span>
                        <Button
                          variant="secondary"
                          onClick={() => navigate(app.path)}
                        >
                          {app.enabled ? "Open app" : "View app"}
                          <ArrowUpRight size={14} />
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty icon={Grid2X2} title="No matching apps">
          Try another search or select All apps.
        </Empty>
      )}
    </>
  );
}
