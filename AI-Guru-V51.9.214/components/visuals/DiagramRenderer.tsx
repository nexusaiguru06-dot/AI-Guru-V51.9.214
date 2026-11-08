"use client";
/**
 * DiagramRenderer — the single entry point the classroom uses to show any
 * AI-requested visual. Validates the shape first (isValidVisual), so a
 * malformed AI output — especially from the weaker offline model — just
 * means "no diagram shown" instead of a crash.
 *
 * AI Guru: only the maths visuals the doubt pane makes (fraction, number line, geometry, graph, bar chart,
 * flowchart, circuit, biology) are kept; the 3-D, GeoGebra, molecule and subject maps of the RAG app are left out.
 */
import type { Visual } from "@/lib/visual-schema";
import { isValidVisual } from "@/lib/visual-schema";
import { GraphPlot } from "./GraphPlot";
import { BarChartVisual } from "./BarChartVisual";
import { GeometryShape } from "./GeometryShape";
import { CircuitDiagram } from "./CircuitDiagram";
import { BiologyDiagramViewer } from "./BiologyDiagramViewer";
import { FractionVisual } from "./FractionVisual";
import { NumberLineVisual } from "./NumberLineVisual";
import { FlowchartVisual } from "./FlowchartVisual";

export function DiagramRenderer({ visual }: { visual: unknown }) {
  if (!isValidVisual(visual)) return <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-center text-xs font-semibold text-amber-900">This visual could not be rendered. Recreate this study material to repair it.</div>;
  const v = visual as Visual;

  switch (v.type) {
    case "graph":       return <GraphPlot visual={v} />;
    case "bar-chart":   return <BarChartVisual visual={v} />;
    case "geometry":    return <GeometryShape visual={v} />;
    case "fraction":    return <FractionVisual visual={v} />;
    case "number-line": return <NumberLineVisual visual={v} />;
    case "flowchart":   return <FlowchartVisual visual={v} />;
    case "circuit":     return <CircuitDiagram visual={v} />;
    case "biology-diagram": return <BiologyDiagramViewer visual={v} />;
    default:            return null;
  }
}
