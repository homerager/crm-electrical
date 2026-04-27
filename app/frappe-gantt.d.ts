declare module 'frappe-gantt' {
  const Gantt: new (el: HTMLElement, tasks: unknown[], opts: unknown) => {
    refresh: (tasks: unknown[]) => void
    change_view_mode: (m: string) => void
    update_options: (o: { column_width?: number }) => void
  }
  export default Gantt
}
