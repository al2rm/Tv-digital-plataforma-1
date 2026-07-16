export default function DataTable({ columns, rows, actions }) {
  if (!rows.length) return <div className="empty-state"><strong>Sin registros</strong></div>;
  return <div className="table-wrap"><table><thead><tr>
    {columns.map(c=><th key={c.key}>{c.label}</th>)}{actions?<th>Acciones</th>:null}
  </tr></thead><tbody>{rows.map(row=><tr key={row.id}>
    {columns.map(c=><td key={c.key}>{c.render?c.render(row):String(row[c.key] ?? "")}</td>)}
    {actions?<td>{actions(row)}</td>:null}
  </tr>)}</tbody></table></div>;
}
