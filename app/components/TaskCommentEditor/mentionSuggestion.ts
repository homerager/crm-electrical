import { VueRenderer } from '@tiptap/vue-3'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion'
import MentionList from './MentionList'

type UserItem = { id: string; name: string }

let cachedUsers: UserItem[] | null = null

async function fetchUsers(): Promise<UserItem[]> {
  if (cachedUsers) return cachedUsers
  try {
    const data = await $fetch<{ users: UserItem[] }>('/api/users')
    cachedUsers = (data.users ?? [])
      .filter((u: any) => u.isActive !== false)
      .map((u: any) => ({ id: u.id, name: u.name }))
    return cachedUsers
  } catch {
    return []
  }
}

export function clearMentionCache() {
  cachedUsers = null
}

const suggestion: Omit<SuggestionOptions<UserItem>, 'editor'> = {
  items: async ({ query }) => {
    const users = await fetchUsers()
    const q = query.toLowerCase()
    return users.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 8)
  },
  render: () => {
    let component: VueRenderer | null = null
    let popup: TippyInstance | null = null

    return {
      onStart: (props: SuggestionProps<UserItem>) => {
        component = new VueRenderer(MentionList, {
          props,
          editor: props.editor,
        })

        if (!props.clientRect) return

        popup = tippy(document.body, {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element!,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        }) as unknown as TippyInstance
      },

      onUpdate(props: SuggestionProps<UserItem>) {
        component?.updateProps(props)
        if (props.clientRect) {
          (popup as any)?.setProps?.({
            getReferenceClientRect: props.clientRect,
          })
        }
      },

      onKeyDown(props: { event: KeyboardEvent }) {
        if (props.event.key === 'Escape') {
          (popup as any)?.hide?.()
          return true
        }
        return (component?.ref as any)?.onKeyDown?.(props.event) ?? false
      },

      onExit() {
        (popup as any)?.destroy?.()
        component?.destroy()
      },
    }
  },
}

export default suggestion
