import { defineComponent, ref, watch } from 'vue'

export default defineComponent({
  name: 'MentionList',
  props: {
    items: { type: Array as () => { id: string; name: string }[], required: true },
    command: { type: Function, required: true },
  },
  setup(props) {
    const selectedIndex = ref(0)

    watch(() => props.items, () => {
      selectedIndex.value = 0
    })

    function selectItem(index: number) {
      const item = props.items[index]
      if (item) {
        props.command({ id: item.id, label: item.name })
      }
    }

    function onKeyDown(event: KeyboardEvent): boolean {
      if (event.key === 'ArrowUp') {
        selectedIndex.value = (selectedIndex.value + props.items.length - 1) % props.items.length
        return true
      }
      if (event.key === 'ArrowDown') {
        selectedIndex.value = (selectedIndex.value + 1) % props.items.length
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex.value)
        return true
      }
      return false
    }

    return { selectedIndex, selectItem, onKeyDown }
  },
  render() {
    if (!this.items.length) {
      return (
        <v-card elevation={4} class="mention-list pa-1" style="min-width: 180px">
          <div class="text-body-2 text-medium-emphasis pa-2">Нікого не знайдено</div>
        </v-card>
      )
    }
    return (
      <v-card elevation={4} class="mention-list pa-1" style="min-width: 180px; max-height: 240px; overflow-y: auto">
        <v-list density="compact" nav>
          {this.items.map((item, idx) => (
            <v-list-item
              key={item.id}
              title={item.name}
              active={idx === this.selectedIndex}
              color="primary"
              rounded="lg"
              onClick={() => this.selectItem(idx)}
              prepend-icon="mdi-account"
            />
          ))}
        </v-list>
      </v-card>
    )
  },
})
