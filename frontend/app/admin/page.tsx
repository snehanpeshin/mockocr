"use client";

import { FormEvent, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const PRODUCTS = [
  { key: "cleanote_tutoring", label: "Cleanote tutoring sessions" },
  { key: "cleanote_monthly", label: "Cleanote monthly subscriptions" }
];

type RevenueRow = {
  amount: string;
  dba_name?: string;
  month?: string;
};

type ActiveSubscription = {
  stripe_subscription_id: string;
  stripe_customer_id: string;
  customer_email: string;
  status: string;
  dba_name: string;
  product_name: string;
  current_period_end: string;
};

type Customer = {
  customer_name: string;
  customer_email: string;
  stripe_customer_id: string;
  dba_name: string;
  total_amount: string;
  latest_payment_date: string;
};

type RevenueSummary = {
  total_revenue: string;
  revenue_by_dba: RevenueRow[];
  revenue_by_month: RevenueRow[];
  active_subscriptions: ActiveSubscription[];
  active_subscription_count: number;
  customers: Customer[];
};

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [paymentLinkProduct, setPaymentLinkProduct] = useState(PRODUCTS[0].key);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingPaymentLink, setIsCreatingPaymentLink] = useState(false);

  async function loadDashboard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE}/api/admin/revenue`, {
        headers: { "X-Admin-Token": token }
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? "Could not load admin dashboard.");
      }
      setSummary(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load admin dashboard.");
    } finally {
      setIsLoading(false);
    }
  }

  async function createPaymentLink() {
    setIsCreatingPaymentLink(true);
    setMessage(null);
    setPaymentLinkUrl(null);

    try {
      const response = await fetch(`${API_BASE}/api/stripe/payment-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": token
        },
        body: JSON.stringify({ product_key: paymentLinkProduct })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? "Could not create payment link.");
      }
      setPaymentLinkUrl(payload.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create payment link.");
    } finally {
      setIsCreatingPaymentLink(false);
    }
  }

  return (
    <main className="admin-shell">
      <section className="admin-header">
        <div>
          <p className="eyebrow">Cleanote admin</p>
          <h1>Revenue dashboard</h1>
          <p className="company-line">Cleanote, a product of Karigari Home LLC</p>
        </div>
        <form className="admin-token-form" onSubmit={loadDashboard}>
          <input
            onChange={(event) => setToken(event.target.value)}
            placeholder="Admin token"
            type="password"
            value={token}
          />
          <button className="primary" disabled={isLoading} type="submit">
            {isLoading ? "Loading" : "Load"}
          </button>
        </form>
      </section>

      {message ? <p className="message">{message}</p> : null}

      {summary ? (
        <section className="admin-grid">
          <div className="admin-card metric-card">
            <p className="eyebrow">Total revenue</p>
            <strong>${summary.total_revenue}</strong>
          </div>
          <div className="admin-card metric-card">
            <p className="eyebrow">Active subscriptions</p>
            <strong>{summary.active_subscription_count}</strong>
          </div>
          <div className="admin-card payment-link-card">
            <h2>Create Payment Link</h2>
            <select
              onChange={(event) => setPaymentLinkProduct(event.target.value)}
              value={paymentLinkProduct}
            >
              {PRODUCTS.map((product) => (
                <option key={product.key} value={product.key}>
                  {product.label}
                </option>
              ))}
            </select>
            <button
              className="primary"
              disabled={isCreatingPaymentLink}
              onClick={createPaymentLink}
              type="button"
            >
              {isCreatingPaymentLink ? "Creating" : "Create link"}
            </button>
            {paymentLinkUrl ? (
              <a href={paymentLinkUrl} rel="noreferrer" target="_blank">
                {paymentLinkUrl}
              </a>
            ) : null}
          </div>

          <Table
            columns={["DBA", "Revenue"]}
            rows={summary.revenue_by_dba.map((row) => [row.dba_name ?? "", `$${row.amount}`])}
            title="Revenue by DBA"
          />
          <Table
            columns={["Month", "Revenue"]}
            rows={summary.revenue_by_month.map((row) => [row.month ?? "", `$${row.amount}`])}
            title="Revenue by month"
          />
          <Table
            columns={["Customer", "Email", "Total", "Latest payment"]}
            rows={summary.customers.map((customer) => [
              customer.customer_name || "Unknown",
              customer.customer_email,
              `$${customer.total_amount}`,
              customer.latest_payment_date.slice(0, 10)
            ])}
            title="Customer list"
          />
          <Table
            columns={["Product", "Email", "Status", "Current period end"]}
            rows={summary.active_subscriptions.map((subscription) => [
              subscription.product_name,
              subscription.customer_email || subscription.stripe_customer_id,
              subscription.status,
              subscription.current_period_end.slice(0, 10)
            ])}
            title="Active subscriptions"
          />
        </section>
      ) : null}
    </main>
  );
}

function Table({
  columns,
  rows,
  title
}: {
  columns: string[];
  rows: string[][];
  title: string;
}) {
  return (
    <div className="admin-card table-card">
      <h2>{title}</h2>
      <div className="admin-table">
        <div className="admin-table-row admin-table-head">
          {columns.map((column) => (
            <span key={column}>{column}</span>
          ))}
        </div>
        {rows.length ? (
          rows.map((row, index) => (
            <div className="admin-table-row" key={`${title}-${index}`}>
              {row.map((cell, cellIndex) => (
                <span key={`${title}-${index}-${cellIndex}`}>{cell}</span>
              ))}
            </div>
          ))
        ) : (
          <p className="message">No data yet.</p>
        )}
      </div>
    </div>
  );
}
