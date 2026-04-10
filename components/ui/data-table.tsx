import type { ReactNode } from "react";

export type DataTableColumn = {
  key: string;
  label: string;
  className?: string;
};

type Props = {
  columns: DataTableColumn[];
  children: ReactNode;
  className?: string;
};

export function DataTable({ columns, children, className = "" }: Props) {
  return (
    <div className={`table-wrap ${className.includes("table-dense") ? "table-wrap-dense" : ""}`.trim()}>
      <table className={`data-table ${className}`.trim()}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.className}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
