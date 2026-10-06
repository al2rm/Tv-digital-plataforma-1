export default function DataTable({ columns, rows, actions, selection }) {
  if (!rows.length) {
    return <div className="empty-inline"><strong>Sin registros</strong></div>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {selection ? (
              <th className="selection-cell">
                <input
                  ref={(input) => {
                    if (input) input.indeterminate = selection.someSelected && !selection.allSelected;
                  }}
                  type="checkbox"
                  aria-label={selection.selectAllLabel || "Seleccionar todos"}
                  checked={selection.allSelected}
                  onChange={(event) => selection.onToggleAll(event.target.checked)}
                />
              </th>
            ) : null}
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
            {actions ? <th>Acciones</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={selection?.selectedIds.has(row.id) ? "table-row--selected" : undefined}>
              {selection ? (
                <td className="selection-cell" data-label="Elegir">
                  <input
                    type="checkbox"
                    aria-label={`${selection.rowLabel || "Seleccionar"} ${row.nombre || row.titulo || row.id}`}
                    checked={selection.selectedIds.has(row.id)}
                    onChange={() => selection.onToggle(row.id)}
                  />
                </td>
              ) : null}
              {columns.map((column) => (
                <td key={column.key} data-label={column.label}>
                  {column.render
                    ? column.render(row)
                    : String(row[column.key] ?? "")}
                </td>
              ))}
              {actions ? (
                <td data-label="Acciones">
                  <div className="table-actions">{actions(row)}</div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
