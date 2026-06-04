import React, { useMemo } from "react";
import { useNaiveParallel } from "../context/NaiveParallelContext";
import { discoverLeafPaths } from "../data/accessors";

export interface ParallelControlProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The axis-management interface: show/hide, remove, reorder, and re-add
 * axes derived from the data; pick the selected column; and control row
 * colorizing (follow the selection, or lock to a specific axis).
 * Opinionated by default, restylable through the np-control classes.
 */
export function ParallelControl(props: ParallelControlProps) {
  const {
    data,
    axes,
    config,
    addAxis,
    removeAxis,
    setAxisHidden,
    reorderAxes,
    selectAxis,
    setColorize,
  } = useNaiveParallel();

  // data paths discovered but not currently in the axes model (re-addable)
  const addablePaths = useMemo(() => {
    const known = new Set(axes.map((a) => a.path));
    return discoverLeafPaths(data).filter((path) => !known.has(path));
  }, [data, axes]);

  const move = (axisId: string, direction: -1 | 1) => {
    const ids = axes.map((a) => a.id);
    const from = ids.indexOf(axisId);
    const to = from + direction;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    reorderAxes(ids);
  };

  return (
    <div
      className={`np-control${props.className ? ` ${props.className}` : ""}`}
      data-testid="np-control"
      style={props.style}
    >
      <ul className="np-control-axes">
        {axes.map((axis) => {
          const selected = config.selectedAxisId === axis.id;
          const unrenderable = axis.kind === "ordinal" && !axis.renderable;
          return (
            <li
              key={axis.id}
              className={`np-control-axis${selected ? " np-control-axis-selected" : ""}`}
              data-testid={`np-control-axis-${axis.id}`}
            >
              <label className="np-control-show" title={unrenderable ? "too many values to render" : "show / hide"}>
                <input
                  type="checkbox"
                  checked={!axis.hidden && !unrenderable}
                  disabled={unrenderable}
                  onChange={(e) => setAxisHidden(axis.id, !e.target.checked)}
                />
              </label>
              <button
                type="button"
                className="np-control-name"
                onClick={() => selectAxis(selected ? null : axis.id)}
              >
                {axis.label}
              </button>
              <span className="np-control-kind">
                {axis.kind === "numerical" ? (axis.temporal ? "cal" : "#") : "abc"}
              </span>
              <button type="button" className="np-control-up" aria-label={`move ${axis.label} up`} onClick={() => move(axis.id, -1)}>
                ↑
              </button>
              <button type="button" className="np-control-down" aria-label={`move ${axis.label} down`} onClick={() => move(axis.id, 1)}>
                ↓
              </button>
              <button type="button" className="np-control-remove" aria-label={`remove ${axis.label}`} onClick={() => removeAxis(axis.id)}>
                ×
              </button>
            </li>
          );
        })}
      </ul>

      {addablePaths.length > 0 && (
        <div className="np-control-add">
          <select
            aria-label="add axis"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) addAxis(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="" disabled>
              add axis…
            </option>
            {addablePaths.map((path) => (
              <option key={path} value={path}>
                {path}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="np-control-colorize">
        <label>
          colorize{" "}
          <select
            aria-label="colorize"
            value={
              config.colorizeMode === "locked"
                ? (config.colorizeAxisId ?? "")
                : config.colorizeMode === "components"
                  ? "__components"
                  : ""
            }
            onChange={(e) =>
              e.target.value === ""
                ? setColorize(null, "follow")
                : e.target.value === "__components"
                  ? setColorize(null, "components")
                  : setColorize(e.target.value, "locked")
            }
          >
            <option value="">follow selected axis</option>
            {axes.filter((a) => a.kind === "numerical" && !a.hidden).length >= 3 && (
              <option value="__components">color components (first 3 numerical → RGB)</option>
            )}
            {axes.map((axis) => (
              <option key={axis.id} value={axis.id}>
                lock to {axis.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
