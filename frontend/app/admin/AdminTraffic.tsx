"use client";

import { useEffect, useState } from "react";

type TrafficReport = {
  allTimeRequests: number;
  allTimeStart: string | null;
  last30Requests: number;
  pageDomain: string;
  pageTraffic: {
    start: string;
    end: string;
    pages: Array<{ path: string; requests: number }>;
  } | null;
};

const count = new Intl.NumberFormat("en-US");

export default function AdminTraffic({ token, refresh }: { token: string; refresh: number }) {
  const [report, setReport] = useState<TrafficReport | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setReport(null);
    setError(false);
    fetch("https://dbk3i1qcyi.execute-api.us-east-1.amazonaws.com/stats", {
      cache: "no-store",
      credentials: "omit",
      headers: { "X-Admin-Token": token },
      signal: controller.signal
    }).then(async (response) => {
      if (!response.ok) throw new Error("Website traffic unavailable");
      const data = await response.json() as TrafficReport;
      if (!controller.signal.aborted) setReport(data);
    }).catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, [token, refresh]);

  const pages = report?.pageTraffic;
  const lastPageDate = pages ? new Date(Date.parse(pages.end) - 86400000).toISOString().slice(0, 10) : "";

  return (
    <section className="traffic-panel" aria-labelledby="traffic-title">
      <h2 id="traffic-title">Website traffic</h2>
      {report ? (
        <>
          <dl className="traffic-totals">
            <div><dt>All-time hosting requests</dt><dd>{report.allTimeStart ? count.format(report.allTimeRequests) : "—"}</dd></div>
            <div><dt>Hosting requests, last 30 days</dt><dd>{report.allTimeStart ? count.format(report.last30Requests) : "—"}</dd></div>
          </dl>
          <p>
            {report.allTimeStart ? "Recorded since " + report.allTimeStart + " UTC. " : "No historical requests were found. "}
            Hosting requests include assets, bots, and other domains on this app, including Pen2Text.
          </p>
          <h3>Traffic by page</h3>
          {pages ? (
            <>
              <p>{report.pageDomain} · {pages.start.slice(0, 10)} to {lastPageDate} UTC · Refreshed daily</p>
              <p>Successful HTML requests, including bots. Asset requests are excluded.</p>
              {pages.pages.length ? (
                <div className="traffic-table-scroll">
                  <table>
                    <caption>Pages ranked by requests</caption>
                    <thead><tr><th scope="col">Page</th><th scope="col">Requests</th></tr></thead>
                    <tbody>
                      {pages.pages.map((page) => (
                        <tr key={page.path}><th scope="row">{page.path}</th><td>{count.format(page.requests)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p>No page requests were found during this period.</p>}
            </>
          ) : <p>The page report is being prepared.</p>}
        </>
      ) : <p role="status">{error ? "Website traffic is temporarily unavailable. Refresh the dashboard to try again." : "Loading traffic…"}</p>}
    </section>
  );
}
