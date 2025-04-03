import imageSize from "image-size";
import { parse } from "node-html-parser";

function getImageSize(buffer) {
	const metadata = imageSize(buffer);
	return { width: metadata.width || 0, height: metadata.height || 0 };
}

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

		if (name.startsWith("http://") || name.startsWith("https://")) {
			name = new URL(name).href;
		} else {
			name = `https://${name}`;
		}
		const answer = await fetch(name);

		if (!answer)
			return new Response(`Failed to fetch: ${name}`, { status: 500 });
		if (!answer.ok)
			return new Response(`Failed to fetch: ${name}`, { status: 500 });

		let foundButtons = {};
		const answerText = await answer.text();

		const root = parse(answerText, {
			fixNestedATags: false,
			parseNoneClosedTags: false,
			blockTextElements: {
				script: false,
				noscript: false,
				style: false,
				pre: false,
				textarea: false,
				document: false,
			},
		});
		const images = root.querySelectorAll("img");
		for (const img of images) {
			if (!img) continue;
			const imgSrc = img.getAttribute("src");
			if (!imgSrc) continue;

			var src = imgSrc;
			if (
				src &&
				!src.startsWith("http://") &&
				!src.startsWith("https://")
			) {
				src = new URL(src, name).href;
			}

			let links_to = null;
			const parentAnchor = img.closest("a");
			if (parentAnchor && parentAnchor.getAttribute("href")) {
				const href = parentAnchor.getAttribute("href");
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

			const imgAlt = img.getAttribute("alt");
			const imgTitle = img.getAttribute("title");

			let button;
			try {
				button = await fetch(src);
			} catch (error) {
				console.log("Failed to fetch image:", src, "Error:", error);
				continue;
			}

			if (!button.ok) {
				console.log(
					"Failed to fetch image:",
					src,
					"Status:",
					button.status
				);
				continue;
			} else {
				let arrayBuffer;
				try {
					arrayBuffer = await button.arrayBuffer();
				} catch (error) {}

				if (!arrayBuffer || arrayBuffer.byteLength == 0) {
					console.log("Empty image buffer for:", src);
					continue;
				}

				let uintArray = new Uint8Array(arrayBuffer);

				foundButtons[src] = {
					src: src,
					links_to: links_to,
					alt: imgAlt,
					title: imgTitle,
					size: getImageSize(uintArray),
					buffer: uintArray,
				};
			}
		}

		if (Object.keys(foundButtons).length === 0) {
			return new Response("No buttons found", { status: 404 });
		}

		let allText = root.text || "";
		allText = allText.replace(/\s+/g, " ").trim(); // Remove extra spaces
		allText = allText.replace(/\n/g, " "); // Remove newlines
		allText = allText.replace(/\r/g, " "); // Remove carriage returns
		allText = allText.replace(/ +/g, " "); // Remove multiple spaces
		allText = allText.replace(/<[^>]+>/g, "").trim().toLowerCase(); // Remove HTML tags, trim and lowercase cuz why not

		return new Response(
			JSON.stringify({
				buttons: foundButtons,
				title: root.querySelector("title")?.text,
				meta: root.querySelector("meta")?.getAttribute("content"),
				rawText: allText,
				links: root.querySelectorAll("a").map(function (a) {
					return {
						href: a.getAttribute("href"),
						text: a.text,
					};
				}),
			}) || {},
			{
				status: 200,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				},
			}
		);
	},
};
