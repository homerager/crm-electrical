import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import ukLocale from '@fullcalendar/core/locales/uk'
import type { CalendarOptions, EventDropArg, EventClickArg, EventMountArg } from '@fullcalendar/core'

const STATUS_COLORS: Record<string, string> = {
  TODO: '#607D8B',
  IN_PROGRESS: '#1976D2',
  REVIEW: '#F57C00',
  DONE: '#388E3C',
  CANCELLED: '#757575',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#43A047',
  MEDIUM: '#FB8C00',
  HIGH: '#E64A19',
  URGENT: '#D32F2F',
}

interface CalendarTask {
  id: string
  title: string
  dueDate: string | null
  status: string
  priority: string
  assignee?: { name: string } | null
  object?: { name: string } | null
  project?: { name: string; color: string } | null
}

// Stable plugin array — must not be recreated on each render
const PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]

export default defineComponent({
  name: 'TaskCalendarWidget',
  props: {
    tasks: { type: Array as () => CalendarTask[], required: true },
    colorBy: { type: String as () => 'status' | 'priority', default: 'status' },
    onTaskClick: { type: Function as unknown as () => (taskId: string) => void, required: true },
    onDateChange: {
      type: Function as unknown as () => (taskId: string, newDate: string) => Promise<void>,
      required: true,
    },
  },
  setup(props) {
    const calendarEvents = computed(() =>
      props.tasks
        .filter((t) => t.dueDate)
        .map((t) => {
          const color =
            props.colorBy === 'status'
              ? STATUS_COLORS[t.status] ?? '#607D8B'
              : PRIORITY_COLORS[t.priority] ?? '#FB8C00'
          return {
            id: t.id,
            title: t.title,
            date: (t.dueDate as string).split('T')[0],
            backgroundColor: color,
            borderColor: color,
            textColor: '#fff',
            extendedProps: {
              assignee: t.assignee?.name ?? null,
              object: t.object?.name ?? null,
            },
          }
        }),
    )

    async function handleDrop(arg: EventDropArg) {
      try {
        await props.onDateChange(arg.event.id, arg.event.startStr)
      }
      catch {
        arg.revert()
      }
    }

    function handleClick(arg: EventClickArg) {
      props.onTaskClick(arg.event.id)
    }

    function handleEventMount(arg: EventMountArg) {
      const ep = arg.event.extendedProps as { assignee: string | null; object: string | null }
      const parts: string[] = []
      if (ep.assignee) parts.push(`👤 ${ep.assignee}`)
      if (ep.object) parts.push(`🏗 ${ep.object}`)
      arg.el.title = parts.length ? `${arg.event.title}\n${parts.join(' · ')}` : arg.event.title
    }

    // FullCalendar Vue 3 expects a single `options` prop — do NOT spread.
    // Reactive `events` array is the only thing that changes; everything else
    // is intentionally kept outside the computed so the Calendar instance is
    // not destroyed/recreated on every filter change.
    const calendarOptions = computed((): CalendarOptions => ({
      plugins: PLUGINS,
      initialView: 'dayGridMonth',
      locale: ukLocale,
      firstDay: 1,
      editable: true,
      events: calendarEvents.value,
      eventDrop: handleDrop,
      eventClick: handleClick,
      eventDidMount: handleEventMount,
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,listMonth',
      },
      height: 'auto',
      dayMaxEvents: 5,
      eventDisplay: 'block',
      noEventsText: 'Немає завдань',
    }))

    return () => (
      <FullCalendar options={calendarOptions.value} />
    )
  },
})
