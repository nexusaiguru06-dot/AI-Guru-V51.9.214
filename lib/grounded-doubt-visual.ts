import type { Visual } from "@/lib/visual-schema";

function safeNode(text: string) {
  return text.replace(/[\[\]{}<>"]/g, "").replace(/\s+/g, " ").trim().slice(0, 72);
}

function compactMath(text: string) {
  return text.toLowerCase().replace(/[×·]/g, "*").replace(/÷/g, "/").replace(/\s+/g, "");
}

function isGroundedMathLine(line: string, evidence: string) {
  if (!/[=+\-×÷*/^]|\d/.test(line)) return true;
  const formulas = line.match(/[a-z0-9().]+(?:\s*[=+\-×÷*/^]\s*[a-z0-9().]+)+/gi) || [];
  const compactEvidence = compactMath(evidence);
  return formulas.length > 0 && formulas.every((formula) => compactEvidence.includes(compactMath(formula)));
}

/**
 * Draw only from the student's question and retrieved textbook evidence.
 * The answer may supply prose labels, but never drawing values or formulae.
 */
export function groundedDoubtVisual(question: string, answer: string, textbookEvidence = ""): Visual | undefined {
  const evidence = `${question}\n${textbookEvidence}`;
  const fraction = /(?:^|\s)(-?\d+)\s*\/\s*(-?\d+)(?:\s|$)/.exec(evidence);
  if (fraction && Number(fraction[2]) !== 0) {
    return { type: "fraction", numerator: Number(fraction[1]), denominator: Number(fraction[2]), style: "bar" };
  }

  const radius = /\br(?:adius)?\s*(?:=|is)\s*(\d+(?:\.\d+)?)/i.exec(evidence);
  if (/\bcircle\b/i.test(evidence) && radius) {
    return { type: "geometry", shape: "circle", radius: Number(radius[1]), labels: { r: radius[1] } };
  }

  const graph = /\by\s*=\s*([0-9a-zx().+\-*/^ ]{1,48})/i.exec(evidence);
  if (graph) {
    const expression = graph[1].trim().replace(/\s+(?:where|for|and|then)\b.*$/i, "");
    const values = (evidence.match(/-?\d+(?:\.\d+)?/g) || []).map(Number).filter(Number.isFinite);
    const extent = Math.max(5, ...values.map(Math.abs).filter(value => value <= 50));
    if (/^[0-9x().+\-*/^ ]+$/i.test(expression)) {
      return { type: "graph", expression, domain: [-extent, extent], label: `y = ${expression}` };
    }
  }

  const steps = answer
    .split(/(?:\r?\n+|(?<=[.!?।])\s+)/)
    .filter((line) => isGroundedMathLine(line, evidence))
    .map(safeNode)
    .filter((line) => line.length >= 8)
    .slice(0, 4);
  if (steps.length >= 2) {
    const nodes = steps.map((line, index) => `${String.fromCharCode(65 + index)}[${line}]`);
    const edges = steps.slice(1).map((_, index) => `${String.fromCharCode(65 + index)} --> ${String.fromCharCode(66 + index)}`);
    return { type: "flowchart", mermaidSyntax: ["flowchart TD", ...nodes, ...edges].join("\n") };
  }
  return undefined;
}
