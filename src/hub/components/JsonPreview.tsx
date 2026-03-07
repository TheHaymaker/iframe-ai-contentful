interface Props {
  data: unknown;
}

/**
 * Syntax-highlighted JSON preview panel.
 * Uses simple regex-based coloring on JSON.stringify output.
 */
export function JsonPreview({ data }: Props) {
  const json = JSON.stringify(data, null, 2);

  const highlighted = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // strings
    .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, '<span style="color:#059669">"$1"</span>')
    // keys (string followed by colon)
    .replace(
      /<span style="color:#059669">"([^"]+)"<\/span>:/g,
      '<span style="color:#8b5cf6">"$1"</span>:',
    )
    // numbers ((?<!#) prevents matching hex color codes in span style attributes)
    .replace(/(?<!#)\b(\d+\.?\d*)\b/g, '<span style="color:#d97706">$1</span>')
    // booleans & null
    .replace(/\b(true|false|null)\b/g, '<span style="color:#dc2626">$1</span>');

  return (
    <pre
      style={{
        margin: 0,
        padding: 12,
        backgroundColor: "#1e293b",
        color: "#e2e8f0",
        borderRadius: 6,
        fontSize: 12,
        lineHeight: 1.5,
        fontFamily: "'Fira Code', 'Cascadia Code', monospace",
        overflowX: "auto",
        maxHeight: 400,
        overflowY: "auto",
      }}
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}
