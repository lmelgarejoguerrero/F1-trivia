const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzKOk8hCNgnOyaVA2EpTvopdhKrbc5u_F8iKi2b7M7EVg6CsGPck8JzSW5MQKnvpq7R/exec";

function buildAppsScriptUrl(payload) {
  const url = new URL(APPS_SCRIPT_URL);

  Object.entries(payload).forEach(([key, value]) => {
    url.searchParams.set(key, value ?? "");
  });

  url.searchParams.set("_ts", Date.now().toString());
  return url.toString();
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, route: "register" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  let payload = req.body || {};

  if (typeof req.body === "string") {
    try {
      payload = JSON.parse(req.body || "{}");
    } catch (error) {
      return res.status(400).json({ ok: false, error: "Invalid JSON body" });
    }
  }
  const firstName = String(payload.firstName || "").trim();
  const lastName = String(payload.lastName || "").trim();
  const email = String(payload.email || "").trim();
  const phone = String(payload.phone || "").trim();

  if (!firstName || !lastName || !email || !phone) {
    return res.status(400).json({ ok: false, error: "Missing required fields" });
  }

  try {
    const upstreamResponse = await fetch(
      buildAppsScriptUrl({ firstName, lastName, email, phone }),
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const upstreamText = await upstreamResponse.text();

    if (!upstreamResponse.ok) {
      return res.status(502).json({
        ok: false,
        error: "Apps Script request failed",
        detail: upstreamText.slice(0, 200),
      });
    }

    let upstreamData = { raw: upstreamText };
    try {
      upstreamData = JSON.parse(upstreamText);
    } catch (error) {
      upstreamData = { raw: upstreamText };
    }

    return res.status(200).json({ ok: true, upstream: upstreamData });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: "Unable to reach Apps Script",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};
