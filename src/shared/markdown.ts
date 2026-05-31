export function renderMarkdown(input: string): string {
  const lines = input.split("\n");
  let html = "";
  let inCodeBlock = false;
  let codeContent = "";
  let inList = false;

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        html += `<pre><code>${codeContent}</code></pre>`;
        codeContent = "";
        inCodeBlock = false;
      } else {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += escapeHtml(line) + "\n";
      continue;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      continue;
    }

    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      html += "<hr>";
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      html += `<h${level}>${inline(headingMatch[2])}</h${level}>`;
      continue;
    }

    if (trimmed.startsWith("> ")) {
      html += `<blockquote>${inline(trimmed.slice(2))}</blockquote>`;
      continue;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline(trimmed.slice(2))}</li>`;
      continue;
    }

    if (inList) {
      html += "</ul>";
      inList = false;
    }

    html += `<p>${inline(trimmed)}</p>`;
  }

  if (inList) {
    html += "</ul>";
  }

  return html;
}

function sanitizeUrl(url: string): string {
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("vbscript:")
  ) {
    return "#";
  }
  return url;
}

function inline(text: string): string {
  let result = escapeHtml(text);
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  result = result.replace(/`([^`]+)`/g, "<code>$1</code>");
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, textContent, url) => {
    return `<a href="${sanitizeUrl(url)}" target="_blank" rel="noopener noreferrer">${textContent}</a>`;
  });
  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
