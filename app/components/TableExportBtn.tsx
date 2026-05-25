import { useExcelExport, type ExportColumn } from '~/composables/useExcelExport'

/**
 * Кнопка експорту таблиці в .xlsx.
 *
 * Приклад:
 *   <TableExportBtn
 *     filename="Товари"
 *     columns={[{ title: 'Назва', key: 'name' }]}
 *     rows={products.value}
 *   />
 */
export default defineComponent({
  name: 'TableExportBtn',
  props: {
    filename: { type: String, required: true },
    rows: { type: Array as PropType<any[]>, required: true },
    columns: { type: Array as PropType<ExportColumn[]>, default: () => [] },
    sheetName: { type: String, default: '' },
    label: { type: String, default: 'Excel' },
    icon: { type: String, default: 'mdi-microsoft-excel' },
    color: { type: String, default: 'success' },
    variant: { type: String as PropType<'text' | 'outlined' | 'tonal' | 'flat' | 'elevated'>, default: 'outlined' },
    size: { type: String, default: 'default' },
    disabled: { type: Boolean, default: false },
  },
  setup(props) {
    const { exportToExcel } = useExcelExport()
    const toast = useToast()
    const busy = ref(false)

    async function onClick() {
      if (!props.rows.length) {
        toast.warning('Немає даних для експорту')
        return
      }
      busy.value = true
      try {
        await exportToExcel({
          filename: props.filename,
          rows: props.rows,
          columns: props.columns,
          sheetName: props.sheetName || undefined,
        })
        toast.success('Файл збережено')
      } catch (e: any) {
        toast.error(e?.message || 'Помилка експорту')
      } finally {
        busy.value = false
      }
    }

    return () => (
      <v-btn
        color={props.color}
        variant={props.variant}
        size={props.size}
        prepend-icon={props.icon}
        loading={busy.value}
        disabled={props.disabled || !props.rows.length}
        onClick={onClick}
      >
        {props.label}
      </v-btn>
    )
  },
})
