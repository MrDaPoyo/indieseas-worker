import * as cheerio from "cheerio";

export default {
	async fetch(request, env, ctx) {
		let url = new URL(request.url);

		const apiKey = url.searchParams.get("key");
		if (apiKey !== env.API_KEY) {
			return new Response("Unauthorized: Invalid API key", {
				status: 401,
			});
		}

		let name = url.searchParams.get("path");
		if (!name) return new Response("No URL to scrape detected.");
		if (!name.startsWith("http://") || !name.startsWith("https://"))
			name = `https://${name}`;
		const answer = await fetch(new URL(name).href);

		if (!answer)
			return new Response(`Failed to fetch: ${name}`, { status: 500 });
		if (!answer.ok)
			return new Response(`Failed to fetch: ${name}`, { status: 500 });

		let foundButtons = {};

		const $ = cheerio.load(await answer.text());
		for (let img of $("img").toArray()) {
	  if (!img) continue;
	  const $img = $(img);
	  const imgSrc = $img.attr('src');
	  console.log(imgSrc);
			if (!imgSrc) continue;

			var src = imgSrc;
			if (src && !src.startsWith("http")) {
				src = new URL(src, name).href;
			}

			let links_to = null;
			const parentAnchor = $img.closest("a");
			if (parentAnchor.length > 0 && parentAnchor.attr("href")) {
				const href = parentAnchor.attr("href");
				try {
					if (
						!href.startsWith("http://") &&
						!href.startsWith("https://")
					) {
						if (href.startsWith("/")) {
							links_to = new URL(href, name).href;
						} else {
							links_to = `https://${href}`;
						}
					} else {
						links_to = href;
					}
				} catch (error) {
					links_to = href;
				}
			}

			if (!src) continue;
      foundButtons[src] = {
        src: src,
        links_to: links_to,
      };
		}

    if (Object.keys(foundButtons).length === 0) {
      return new Response("No buttons found", { status: 404 });
    }

		return new Response(JSON.stringify(foundButtons) || {}, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
	},
};
