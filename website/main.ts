const apiUrl = "https://api.github.com/repos/0xSero/vllm-studio/releases/latest";

const versionNode = document.querySelector<HTMLElement>("#release-version");
const statusNode = document.querySelector<HTMLElement>("#release-status");
const assetListNode = document.querySelector<HTMLUListElement>("#asset-list");

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  assets: GitHubAsset[];
}

function setText(node: HTMLElement | null, value: string) {
  if (node) {
    node.textContent = value;
  }
}

function renderAssets(assets: GitHubAsset[]) {
  if (!assetListNode) return;
  assetListNode.innerHTML = "";

  if (assets.length === 0) {
    setText(statusNode, "No release assets published yet.");
    return;
  }

  setText(statusNode, `${assets.length} downloadable asset${assets.length === 1 ? "" : "s"}.`);

  for (const asset of assets) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = asset.browser_download_url;
    link.textContent = asset.name;
    link.target = "_blank";
    link.rel = "noreferrer";
    item.appendChild(link);
    assetListNode.appendChild(item);
  }
}

async function loadRelease() {
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status}`);
    }

    const release = (await response.json()) as GitHubRelease;
    setText(versionNode, release.tag_name || "Latest release");
    renderAssets(release.assets || []);
  } catch {
    setText(versionNode, "Latest release unavailable");
    setText(statusNode, "Unable to fetch GitHub release assets right now.");
  }
}

void loadRelease();
