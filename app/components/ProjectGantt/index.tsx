import { computed, nextTick, onMounted, onUnmounted, ref, watch, type PropType } from 'vue'
import { useTheme } from 'vuetify'
import './gantt.css'

const STATUS_ORDER = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'] as const

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function toYmd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function taskBarRange(task: any): { start: Date; end: Date } {
  const created = startOfDay(new Date(task.createdAt))
  if (task.dueDate) {
    const end = startOfDay(new Date(task.dueDate))
    if (end < created) return { start: end, end: end }
    return { start: created, end: end }
  }
  if (task.estimatedHours && task.estimatedHours > 0) {
    const d = Math.max(1, Math.ceil(task.estimatedHours / 8))
    return { start: created, end: addDays(created, d - 1) }
  }
  return { start: created, end: created }
}

function statusCustomClass(status: string) {
  if (status === 'DONE') return 'gantt-status-done'
  if (status === 'CANCELLED') return 'gantt-status-cancelled'
  if (status === 'IN_PROGRESS') return 'gantt-status-active'
  if (status === 'REVIEW') return 'gantt-status-review'
  return 'gantt-status-todo'
}

function progressForStatus(status: string) {
  if (status === 'DONE') return 100
  if (status === 'IN_PROGRESS') return 45
  if (status === 'REVIEW') return 80
  return 0
}

export type GanttTask = {
  id: string
  title: string
  status: string
  createdAt: string
  dueDate: string | null
  estimatedHours: number | null
  assignee: { id: string; name: string } | null
}

type SortKey = 'start' | 'due' | 'status'
type ViewName = 'Day' | 'Week' | 'Month'
type GanttApi = {
  refresh: (tasks: unknown[]) => void
  change_view_mode: (m: string) => void
  update_options: (o: { column_width?: number }) => void
}

export default defineComponent({
  name: 'ProjectGantt',
  props: {
    tasks: { type: Array as PropType<GanttTask[]>, required: true },
    loading: { type: Boolean, default: false },
    projectColor: { type: String, default: '#1976D2' },
  },
  setup(_props) {
    const theme = useTheme()
    const ganttRef = ref<HTMLDivElement | null>(null)
    const ganttIdSignature = ref('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let gantt: GanttApi | any = null

    const sortBy = ref<SortKey>('start')
    const viewMode = ref<ViewName>('Day')
    const columnWidth = ref(50)

    const sortFn = (a: GanttTask, b: GanttTask) => {
      if (sortBy.value === 'start') {
        const { start: sa } = taskBarRange(a)
        const { start: sb } = taskBarRange(b)
        return sa.getTime() - sb.getTime() || a.title.localeCompare(b.title, 'uk')
      }
      if (sortBy.value === 'due') {
        const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY
        const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY
        if (ad !== bd) return ad - bd
        const { start: sa } = taskBarRange(a)
        const { start: sb } = taskBarRange(b)
        return sa.getTime() - sb.getTime()
      }
      const oa = STATUS_ORDER.indexOf(a.status as (typeof STATUS_ORDER)[number])
      const ob = STATUS_ORDER.indexOf(b.status as (typeof STATUS_ORDER)[number])
      const o = (oa === -1 ? 99 : oa) - (ob === -1 ? 99 : ob)
      if (o !== 0) return o
      return taskBarRange(a).start.getTime() - taskBarRange(b).start.getTime()
    }

    const prepared = computed(() => {
      return _props.tasks
        .filter((t) => t)
        .slice()
        .sort((a, b) => sortFn(a, b))
    })

    const chartTasks = computed(() => {
      return prepared.value.map((t) => {
        const { start, end } = taskBarRange(t)
        return {
          id: t.id,
          name: t.title,
          start: toYmd(start),
          end: toYmd(end),
          progress: progressForStatus(t.status),
          custom_class: statusCustomClass(t.status),
        }
      })
    })

    const containerHeightPx = computed(() =>
      Math.min(900, Math.max(440, 110 + Math.max(1, prepared.value.length) * 52 + 220)),
    )

    function ganttOptions() {
      return {
        view_mode: viewMode.value,
        view_mode_select: false,
        language: 'uk' as const,
        readonly: true,
        readonly_dates: true,
        readonly_progress: true,
        infinite_padding: true,
        today_button: true,
        scroll_to: 'today' as const,
        container_height: containerHeightPx.value,
        column_width: Number(columnWidth.value),
        bar_height: 30,
        padding: 14,
        lines: 'both' as const,
        upper_header_height: 44,
        lower_header_height: 36,
        popup_on: 'hover' as const,
        popup: (ctx: { task: { name: string; _start: Date; _end: Date }; set_title: (s: string) => void; set_subtitle: (s: string) => void; set_details: (s: string) => void }) => {
          ctx.set_title(ctx.task.name)
          ctx.set_subtitle('')
          const s = new Date(ctx.task._start)
          const endExclusive = new Date(ctx.task._end)
          const last = new Date(endExclusive.getTime() - 1)
          const f = (d: Date) =>
            d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
          ctx.set_details(`Період: ${f(s)} — ${f(last)}.`)
        },
        on_click: (task: { id: string | number }) => {
          void navigateTo(`/tasks/${String(task.id)}`)
        },
      }
    }

    async function buildChart() {
      if (!ganttRef.value) return
      gantt = null
      ganttRef.value.innerHTML = ''
      const { default: Gantt } = await import('frappe-gantt')
      // eslint-disable-next-line new-cap, @typescript-eslint/no-explicit-any
      gantt = new (Gantt as any)(ganttRef.value, chartTasks.value, ganttOptions()) as GanttApi
    }

    async function trySync() {
      if (import.meta.server) return
      if (_props.loading || prepared.value.length === 0) {
        gantt = null
        ganttIdSignature.value = ''
        if (ganttRef.value) ganttRef.value.innerHTML = ''
        return
      }
      await nextTick()
      await nextTick()
      if (!ganttRef.value) return

      const idSig = chartTasks.value.map((t) => `${t.id}:${t.start}:${t.end}`).join('|')
      if (!gantt) {
        await buildChart()
        ganttIdSignature.value = idSig
        return
      }
      if (ganttIdSignature.value !== idSig) {
        ganttIdSignature.value = idSig
        gantt.refresh(chartTasks.value)
      }
      gantt.change_view_mode(viewMode.value)
      gantt.update_options({
        column_width: Number(columnWidth.value),
        container_height: containerHeightPx.value,
        infinite_padding: true,
      })
    }

    onMounted(() => {
      void trySync()
    })

    onUnmounted(() => {
      gantt = null
      ganttIdSignature.value = ''
      if (ganttRef.value) ganttRef.value.innerHTML = ''
    })

    watch(
      () =>
        [chartTasks.value, _props.loading, viewMode.value, columnWidth.value, containerHeightPx.value] as const,
      () => {
        void trySync()
      },
      { deep: true },
    )

    watch(
      () => theme.global.name.value,
      () => {
        gantt = null
        ganttIdSignature.value = ''
        void trySync()
      },
    )

    return () => (
      <v-card variant="outlined" class="project-gantt w-100" data-frappe-gantt-wrap>
        <div
          class="d-flex flex-wrap align-center pa-3 gap-3 border-b"
          style={{ borderColor: 'rgba(var(--v-border-color), 0.12)' }}
        >
          <v-chip size="small" variant="tonal" color="default">
            Завдань: {prepared.value.length}
          </v-chip>
          <v-select
            v-model={sortBy.value}
            label="Сортування"
            style={{ minWidth: '200px', maxWidth: '240px' }}
            density="compact"
            hide-details
            items={[
              { value: 'start', title: 'За датою старту' },
              { value: 'due', title: 'За дедлайном' },
              { value: 'status', title: 'За статусом' },
            ]}
          />
          <v-select
            v-model={viewMode.value}
            label="Вигляд сітки"
            style={{ minWidth: '160px', maxWidth: '200px' }}
            density="compact"
            hide-details
            items={[
              { value: 'Day' as const, title: 'По днях' },
              { value: 'Week' as const, title: 'По тижнях' },
              { value: 'Month' as const, title: 'По місяцях' },
            ]}
          />
          <v-select
            v-model={columnWidth.value}
            label="Ширина дня (реком. 50+)"
            style={{ minWidth: '220px', maxWidth: '280px' }}
            density="compact"
            hide-details
            item-title="title"
            item-value="value"
            items={[
              { value: 32, title: 'Компакт (32px)' },
              { value: 40, title: 'Звичайний (40px)' },
              { value: 50, title: 'Рекомендовано (50px)' },
              { value: 64, title: 'Великий (64px)' },
            ]}
          />
          <v-spacer />
        </div>

        {_props.loading
          ? (
              <v-skeleton-loader class="ma-4" type="image" height="400" />
            )
          : prepared.value.length === 0
            ? (
                <div class="text-medium-emphasis text-body-2 pa-8 text-center">Немає завдань у проєкті</div>
              )
            : (
                <div
                  class="gantt-embed"
                >
                  <div
                    ref={ganttRef}
                    class="gantt-embed__inner frappe-gantt-vuetify v-theme-adapter"
                    role="img"
                    aria-label="Діаграма Ганта (Frappe Gantt)"
                  />
                </div>
              )}
        <v-card-text class="text-caption text-medium-emphasis py-2">
          Старт смуги — дата створення, кінець — дедлайн (якщо є), інакше оцінка за план. год. Кнопка
          «Сьогодні» — зверху в правому куті діаграми.
        </v-card-text>
      </v-card>
    )
  },
})
