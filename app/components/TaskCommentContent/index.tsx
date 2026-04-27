import { defineComponent, h } from 'vue'
import './style.css'

export default defineComponent({
  name: 'TaskCommentContent',
  props: {
    html: { type: String, required: true },
  },
  render() {
    return h('div', {
      class: 'task-comment-html text-body-2',
      innerHTML: this.html,
    })
  },
})
