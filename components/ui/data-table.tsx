import type { ReactNode } from "react";

export type DataTableColumn = {
  key: string;
  label: string;
  className?: string;
};

type Props = {
  columns: DataTableColumn[];
  children: ReactNode;
};

export function DataTable({ columns, children }: Props) {
  return (
    <div className="table-wrap">
      <table className="data-table">
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
