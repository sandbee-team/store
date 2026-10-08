import {
  ReceiptText,
  ShieldCheck,
  ArrowUpRight,
  CreditCard,
} from "lucide-react";
import { PageTitle, Pill, Section, Button, Empty } from "../components/ui";
export const money = (minor, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
export default function Billing({ data, navigate }) {
  const billing = data.billing;
  return (
    <>
      <PageTitle
        title="Billing"
        action={<Pill tone="green">Free workspace</Pill>}
      >
        Plans and subscriptions for {data.workspace.name}.
      </PageTitle>
      <div className="billing-overview">
        <section className="billing-balance panel">
          <div className="billing-heading">
            <CreditCard size={19} />
            <span>Amount due</span>
          </div>
          <strong>{money(billing.amountDueMinor)}</strong>
          <p>Your current apps are free. No card or payment is required.</p>
          <div className="billing-assurance">
            <ShieldCheck size={15} />
            No automatic charges
          </div>
        </section>
        <Section
          title="One workspace, all your apps"
          description="Manage access and plans in one place."
        >
          <dl className="compact-facts">
            <div>
              <dt>Current plan</dt>
              <dd>{billing.plan}</dd>
            </div>
            <div>
              <dt>Enabled apps</dt>
              <dd>{billing.subscriptions.length}</dd>
            </div>
            <div>
              <dt>Monthly app charges</dt>
              <dd>{money(billing.monthlyTotalMinor)}</dd>
            </div>
            <div>
              <dt>Payment method</dt>
              <dd>Not required</dd>
            </div>
          </dl>
        </Section>
      </div>
      <Section
        title="App subscriptions"
        description="Only enabled apps appear here."
        action={
          <Button variant="secondary" onClick={() => navigate("/apps")}>
            Browse apps
            <ArrowUpRight size={14} />
          </Button>
        }
      >
        {billing.subscriptions.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>App</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th className="numeric">Monthly price</th>
                  <th>
                    <span className="sr-only">Open app</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {billing.subscriptions.map((app) => (
                  <tr key={app.appId}>
                    <td>
                      <strong>{app.name}</strong>
                    </td>
                    <td>
                      <Pill>{app.label}</Pill>
                    </td>
                    <td>Active</td>
                    <td className="numeric">
                      {money(app.amountMinor, app.currency)}
                    </td>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => navigate(app.path)}
                      >
                        Open app
                        <ArrowUpRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={CreditCard} title="No subscriptions yet">
            Enable an app from the catalog to get started for free.
          </Empty>
        )}
      </Section>
      <Section title="Invoices">
        <div className="invoice-empty">
          <ReceiptText size={25} />
          <div>
            <h3>No invoices</h3>
            <p>
              No payments have been collected. Your free apps do not generate
              invoices.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
