import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import ukLocale from '@fullcalendar/core/locales/uk'
import type { CalendarOptions, EventDropArg, EventClickArg, EventMountArg, DateSelectArg } from '@fullcalendar/core'

const TYPE_COLORS: Record<string, string> = {
  WORK: '#1976D2',
  DAY_OFF: '#607D8B',
  VACATION: '#43A047',
  SICK_LEAVE: '#E64A19',
}

const SHIFT_SUFFIX: Record<string, string> = {
  FULL_DAY: '',
  MORNING: ' (ранок)',
  AFTERNOON: ' (день)',
}

const SHIFT_DEFAULT_HOURS: Record<string, number> = {
  FULL_DAY: 8,
  MORNING: 4,
  AFTERNOON: 4,
}

interface ScheduleEntry {
  id: string
  userId: string
  date: string
  type: string
  shift: string
  hours: number | null
  description: string | null
  user: { id: string; name: string; jobTitle?: { name: string } | null }
  object?: { id: string; name: string } | null
}

const PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]

export default defineComponent({
  name: 'ScheduleCalendarWidget',
  props: {
    schedules: { type: Array as () => ScheduleEntry[], required: true },
    colorBy: { type: String as () => 'type' | 'user', default: 'type' },
    onEntryClick: { type: Function as unknown as () => (id: string) => void, required: true },
    onDateSelect: { type: Function as unknown as () => (date: string) => void, default: undefined },
    onDrop: {
      type: Function as unknown as () => (id: string, newDate: string) => Promise<void>,
      default: undefined,
    },
  },
  setup(props) {
    const userColorMap = computed(() => {
      const palette = [
        '#1976D2', '#43A047', '#E64A19', '#8E24AA', '#F9A825',
        '#00897B', '#D81B60', '#5E35B1', '#3949AB', '#00ACC1',
        '#C0CA33', '#6D4C41', '#546E7A', '#FF6F00', '#AD1457',
      ]
      const map: Record<string, string> = {}
      const uniqueUserIds = [...new Set(props.schedules.map((s) => s.userId))]
      uniqueUserIds.forEach((uid, i) => {
        map[uid] = palette[i % palette.length]
      })
      return map
    })

    const calendarEvents = computed(() =>
      props.schedules.map((s) => {
        const color = props.colorBy === 'type'
          ? TYPE_COLORS[s.type] ?? '#607D8B'
          : userColorMap.value[s.userId] ?? '#1976D2'

        const h = s.hours ?? SHIFT_DEFAULT_HOURS[s.shift] ?? 8
        const shiftLabel = SHIFT_SUFFIX[s.shift] ?? ''
        const title = `${s.user.name}${shiftLabel} · ${h}г`

        return {
          id: s.id,
          title,
          date: s.date.split('T')[0],
          backgroundColor: color,
          borderColor: color,
          textColor: '#fff',
          extendedProps: {
            object: s.object?.name ?? null,
            type: s.type,
            hours: h,
            description: s.description,
          },
        }
      }),
    )

    function handleClick(arg: EventClickArg) {
      props.onEntryClick(arg.event.id)
    }

    async function handleDrop(arg: EventDropArg) {
      if (!props.onDrop) { arg.revert(); return }
      try {
        await props.onDrop(arg.event.id, arg.event.startStr)
      } catch {
        arg.revert()
      }
    }

    function handleSelect(arg: DateSelectArg) {
      if (props.onDateSelect) {
        props.onDateSelect(arg.startStr)
      }
    }

    function handleEventMount(arg: EventMountArg) {
      const ep = arg.event.extendedProps as { object: string | null; type: string; hours: number; description: string | null }
      const parts: string[] = [arg.event.title]
      if (ep.object) parts.push(`Обʼєкт: ${ep.object}`)
      parts.push(`Годин: ${ep.hours}`)
      if (ep.description) parts.push(ep.description)
      arg.el.title = parts.join('\n')
    }

    const calendarOptions = computed((): CalendarOptions => ({
      plugins: PLUGINS,
      initialView: 'dayGridMonth',
      locale: ukLocale,
      firstDay: 1,
      editable: !!props.onDrop,
      selectable: !!props.onDateSelect,
      events: calendarEvents.value,
      eventDrop: handleDrop,
      eventClick: handleClick,
      select: handleSelect,
      eventDidMount: handleEventMount,
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,listMonth',
      },
      height: 'auto',
      dayMaxEvents: 6,
      eventDisplay: 'block',
      noEventsText: 'Немає записів',
    }))

    return () => (
      <FullCalendar options={calendarOptions.value} />
    )
  },
})
