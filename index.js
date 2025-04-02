import * as cheerio from "cheerio";

export default {
  async fetch(request, env, ctx) {
    let url = new URL(request.url);
    let name = url.searchParams.get("path");
    if (!name) return new Response("No URL to scrape detected.")
    if (!name.startsWith("http://") || !name.startsWith("https://")) name = `https://${name}`; 
    const answer = await fetch(new URL(name).href);
    if (!answer) return new Response(`Failed to fetch: ${fetch.}`)
    const $ = cheerio.load(await answer.text())
    return new Response($("img"));
  },
};