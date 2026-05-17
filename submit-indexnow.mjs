const host = "trial-to-paid-conversion-sample-size-calculator.vercel.app";
const key = "ae5f24b9dda9ad3ae18484a58dd64720";
const baseUrl = `https://${host}`;
const urls = ["/", "/llms.txt", "/sitemap.xml"].map((pathname) => `${baseUrl}${pathname}`);

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    host,
    key,
    keyLocation: `${baseUrl}/${key}.txt`,
    urlList: urls
  })
});

console.log(JSON.stringify({ status: response.status, urls }, null, 2));
if (!response.ok && response.status !== 202) {
  process.exitCode = 1;
}
