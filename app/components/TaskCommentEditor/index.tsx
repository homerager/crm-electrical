import { defineComponent, onBeforeUnmount, onMounted, ref, unref, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { StarterKit } from '@tiptap/starter-kit'
import { Link } from '@tiptap/extension-link'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Underline } from '@tiptap/extension-underline'
import type { Editor } from '@tiptap/core'
import './style.css'

export default defineComponent({
  name: 'TaskCommentEditor',
  props: {
    modelValue: { type: String, required: true },
    readOnly: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    placeholder: { type: String, default: 'Ваш коментар...' },
    variant: { type: String as () => 'outlined' | 'minimal', default: 'outlined' },
  },
  emits: ['update:modelValue', 'update:isTextEmpty'],
  setup(props, { emit }) {
    const uiTick = ref(0)
    const editor = useEditor({
      extensions: [
        StarterKit.configure({ heading: false, codeBlock: false }),
        Underline,
        Link.configure({
          openOnClick: false,
          autolink: true,
        }),
        Placeholder.configure({ placeholder: props.placeholder }),
      ],
      content: props.modelValue,
      editorProps: {
        attributes: {
          class: 'prose',
        },
      },
      editable: !props.readOnly && !props.disabled,
      onUpdate: ({ editor: ed }) => {
        uiTick.value += 1
        const html = ed.getHTML()
        const empty = ed.getText().replace(/\s+/g, '').length === 0
        emit('update:modelValue', html)
        emit('update:isTextEmpty', empty)
      },
      onSelectionUpdate: () => {
        uiTick.value += 1
      },
      onTransaction: () => {
        uiTick.value += 1
      },
    })

    function isEditorEmpty() {
      if (!editor.value) return true
      return editor.value.getText().replace(/\s+/g, '').length === 0
    }

    onMounted(() => {
      if (editor.value) {
        editor.value.setEditable(!props.readOnly && !props.disabled, false)
        emit('update:isTextEmpty', isEditorEmpty())
      }
    })

    function onLink() {
      if (!editor.value) return
      const had = editor.value.getAttributes('link')?.href as string | undefined
      const current = had
        ? had
        : typeof window !== 'undefined'
          ? window.prompt('URL посилання', 'https://') || ''
          : ''
      if (current) {
        if (!editor.value) return
        if (!/^https?:/i.test(current) && !/^mailto:/i.test(current)) {
          if (typeof window !== 'undefined') window.alert('Потрібен лінк http, https або mailto:')
          return
        }
        editor.value?.chain().focus().extendMarkRange('link').setLink({ href: current }).run()
        uiTick.value += 1
      } else if (had) {
        editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
        uiTick.value += 1
      }
    }

    watch(
      () => props.modelValue,
      (v) => {
        if (!editor.value) return
        const now = editor.value.getHTML()
        if (v !== now) editor.value.commands.setContent(v || '<p></p>', { emitUpdate: false })
      }
    )

    watch(
      () => props.readOnly,
      (v) => {
        editor.value?.setEditable(!v && !props.disabled, false)
      }
    )

    watch(
      () => props.disabled,
      (d) => {
        editor.value?.setEditable(!props.readOnly && !d, false)
      }
    )

    onBeforeUnmount(() => {
      editor.value?.destroy()
    })

    return { editor, uiTick, onLink, isEditorEmpty }
  },
  render() {
    void this.uiTick
    const ed = unref(this.editor) as Editor | undefined
    if (!ed) {
      return <v-skeleton-loader type="article" />
    }
    const p = this.$props
    return (
      <div
        class={[
          'task-comment-editor',
          'rounded',
          p.variant === 'outlined' ? 'editor-outlined' : 'editor-minimal',
        ]}
      >
        {!p.readOnly && (
          <div class="d-flex flex-wrap align-center pa-1 gap-1 editor-tb">
            <v-btn
              type="button"
              icon="mdi-format-bold"
              size="x-small"
              variant="text"
              color={ed.isActive('bold') ? 'primary' : 'default'}
              disabled={p.disabled}
              onClick={() => !p.disabled && ed.chain().focus().toggleBold().run()}
            />
            <v-btn
              type="button"
              icon="mdi-format-italic"
              size="x-small"
              variant="text"
              color={ed.isActive('italic') ? 'primary' : 'default'}
              disabled={p.disabled}
              onClick={() => !p.disabled && ed.chain().focus().toggleItalic().run()}
            />
            <v-btn
              type="button"
              icon="mdi-format-underline"
              size="x-small"
              variant="text"
              color={ed.isActive('underline') ? 'primary' : 'default'}
              disabled={p.disabled}
              onClick={() => !p.disabled && ed.chain().focus().toggleUnderline().run()}
            />
            <v-divider vertical class="mx-0" style="min-height: 20px" />
            <v-btn
              type="button"
              icon="mdi-format-list-bulleted"
              size="x-small"
              variant="text"
              color={ed.isActive('bulletList') ? 'primary' : 'default'}
              disabled={p.disabled}
              onClick={() => !p.disabled && ed.chain().focus().toggleBulletList().run()}
            />
            <v-btn
              type="button"
              icon="mdi-format-list-numbered"
              size="x-small"
              variant="text"
              color={ed.isActive('orderedList') ? 'primary' : 'default'}
              disabled={p.disabled}
              onClick={() => !p.disabled && ed.chain().focus().toggleOrderedList().run()}
            />
            <v-btn
              type="button"
              icon="mdi-format-indent-increase"
              size="x-small"
              variant="text"
              disabled={p.disabled}
              onClick={() => !p.disabled && ed.chain().focus().sinkListItem('listItem').run()}
            />
            <v-btn
              type="button"
              icon="mdi-format-indent-decrease"
              size="x-small"
              variant="text"
              disabled={p.disabled}
              onClick={() => !p.disabled && ed.chain().focus().liftListItem('listItem').run()}
            />
            <v-divider vertical class="mx-0" style="min-height: 20px" />
            <v-btn
              type="button"
              icon="mdi-link-variant"
              size="x-small"
              variant="text"
              color={ed.isActive('link') ? 'primary' : 'default'}
              disabled={p.disabled}
              onClick={() => !p.disabled && this.onLink()}
            />
          </div>
        )}
        <EditorContent editor={ed as never} class="editor-canvas" />
      </div>
    )
  },
})
