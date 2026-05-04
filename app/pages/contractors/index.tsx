export default defineComponent({
  name: 'ContractorsPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    useHead({
      title: 'Контрагенти'
    })

    const { isPrivileged } = useAuth()
    const { data, refresh, pending } = useFetch('/api/contractors')
    const contractors = computed(() => (data.value as any)?.contractors ?? [])

    const dialog = ref(false)
    const deleteDialog = ref(false)
    const saving = ref(false)
    const error = ref('')
    const editItem = ref<any>(null)
    const deleteItem = ref<any>(null)

    const form = reactive({ name: '', contactPerson: '', phone: '', email: '', address: '', notes: '' })

    function openCreate() {
      editItem.value = null
      Object.assign(form, { name: '', contactPerson: '', phone: '', email: '', address: '', notes: '' })
      dialog.value = true
    }

    function openEdit(item: any) {
      editItem.value = item
      Object.assign(form, {
        name: item.name,
        contactPerson: item.contactPerson || '',
        phone: item.phone || '',
        email: item.email || '',
        address: item.address || '',
        notes: item.notes || '',
      })
      dialog.value = true
    }

    function openDelete(item: any) {
      deleteItem.value = item
      deleteDialog.value = true
    }

    async function save() {
      saving.value = true
      error.value = ''
      try {
        if (editItem.value) {
          await $fetch(`/api/contractors/${editItem.value.id}`, { method: 'PUT', body: form })
        } else {
          await $fetch('/api/contractors', { method: 'POST', body: form })
        }
        dialog.value = false
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        saving.value = false
      }
    }

    async function confirmDelete() {
      if (!deleteItem.value) return
      try {
        await $fetch(`/api/contractors/${deleteItem.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        await refresh()
      } catch (e: any) {
        error.value = e?.data?.statusMessage || 'Помилка видалення'
      }
    }

    const headers = [
      { title: 'Назва', key: 'name' },
      { title: 'Контактна особа', key: 'contactPerson' },
      { title: 'Телефон', key: 'phone' },
      { title: 'Email', key: 'email' },
      { title: 'Адреса', key: 'address' },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 100 },
    ]

    return () => (
      <div>
        <div class="page-toolbar">
          <div class="text-h5 font-weight-bold">Контрагенти</div>
          <v-spacer />
          {isPrivileged.value && (
            <v-btn color="primary" prepend-icon="mdi-plus" onClick={openCreate}>
              Додати контрагента
            </v-btn>
          )}
        </div>

        <v-card>
          <v-data-table headers={headers} items={contractors.value} loading={pending.value} hover>
            {{
              'item.phone': ({ item }: any) => (
                item.phone
                  ? <a href={`tel:${item.phone}`} class="text-decoration-none">{item.phone}</a>
                  : <span class="text-medium-emphasis">—</span>
              ),
              'item.email': ({ item }: any) => (
                item.email
                  ? <a href={`mailto:${item.email}`} class="text-decoration-none">{item.email}</a>
                  : <span class="text-medium-emphasis">—</span>
              ),
              'item.actions': ({ item }: any) => (
                <div class="d-flex gap-1 justify-end">
                  {isPrivileged.value && (
                    <>
                      <v-btn icon="mdi-pencil" variant="text" size="small" color="primary" onClick={() => openEdit(item)} />
                      <v-btn icon="mdi-delete" variant="text" size="small" color="error" onClick={() => openDelete(item)} />
                    </>
                  )}
                </div>
              ),
            }}
          </v-data-table>
        </v-card>

        <v-dialog v-model={dialog.value} max-width={560}>
          <v-card>
            <v-card-title>{editItem.value ? 'Редагувати контрагента' : 'Новий контрагент'}</v-card-title>
            <v-card-text>
              {error.value && <v-alert type="error" variant="tonal" class="mb-3">{error.value}</v-alert>}
              <v-text-field v-model={form.name} label="Назва *" class="mb-3" />
              <v-text-field v-model={form.contactPerson} label="Контактна особа" class="mb-3" />
              <v-row>
                <v-col cols={6}>
                  <v-text-field v-model={form.phone} label="Телефон" prepend-inner-icon="mdi-phone" />
                </v-col>
                <v-col cols={6}>
                  <v-text-field v-model={form.email} label="Email" type="email" prepend-inner-icon="mdi-email" />
                </v-col>
              </v-row>
              <v-text-field v-model={form.address} label="Адреса" class="mb-3 mt-3" />
              <v-textarea v-model={form.notes} label="Примітки" rows={2} />
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (dialog.value = false)}>Скасувати</v-btn>
              <v-btn color="primary" variant="elevated" loading={saving.value} disabled={!form.name} onClick={save}>
                {editItem.value ? 'Зберегти' : 'Створити'}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-dialog v-model={deleteDialog.value} max-width={400}>
          <v-card>
            <v-card-title>Видалити контрагента?</v-card-title>
            <v-card-text>Контрагент "{deleteItem.value?.name}" буде видалено.</v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (deleteDialog.value = false)}>Скасувати</v-btn>
              <v-btn color="error" variant="elevated" onClick={confirmDelete}>Видалити</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>
    )
  },
})
