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

    const form = reactive({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
      taxCode: '',
      iban: '',
      bankName: '',
      bankMfo: '',
      paymentNotes: '',
    })

    function openCreate() {
      editItem.value = null
      Object.assign(form, {
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
        taxCode: '',
        iban: '',
        bankName: '',
        bankMfo: '',
        paymentNotes: '',
      })
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
        taxCode: item.taxCode || '',
        iban: item.iban || '',
        bankName: item.bankName || '',
        bankMfo: item.bankMfo || '',
        paymentNotes: item.paymentNotes || '',
      })
      dialog.value = true
    }

    function contractorHasPayment(item: any) {
      return !!(item?.taxCode || item?.iban || item?.bankName || item?.bankMfo || item?.paymentNotes)
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
      { title: 'Реквізити', key: 'payment', sortable: false, align: 'center' as const, width: 88 },
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
              'item.payment': ({ item }: any) => (
                contractorHasPayment(item)
                  ? (
                      <v-tooltip text="Заповнені платіжні реквізити" location="bottom">
                        {{
                          activator: ({ props }: any) => (
                            <span {...props} class="d-inline-flex align-center justify-center" style={{ width: '100%' }}>
                              <v-icon color="success" size="small">mdi-bank-check</v-icon>
                            </span>
                          ),
                        }}
                      </v-tooltip>
                    )
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

        <v-dialog v-model={dialog.value} max-width={640} scrollable>
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
              <v-textarea v-model={form.notes} label="Примітки" rows={2} class="mb-2" />

              <v-divider class="my-4" />
              <div class="text-subtitle-2 mb-3 d-flex align-center gap-2">
                <v-icon size="small" color="primary">mdi-bank-outline</v-icon>
                Платіжна інформація
              </div>
              <v-text-field v-model={form.taxCode} label="ЄДРПОУ / ІПН" class="mb-3" hint="Для юрособи — ЄДРПОУ, для ФОП — ІПН" persistent-hint />
              <v-text-field v-model={form.iban} label="IBAN" class="mb-4 mt-4" prepend-inner-icon="mdi-numeric" autocomplete="off" />
              <v-row>
                <v-col cols={12} md={8}>
                  <v-text-field v-model={form.bankName} label="Назва банку" prepend-inner-icon="mdi-bank" />
                </v-col>
                <v-col cols={12} md={4}>
                  <v-text-field v-model={form.bankMfo} label="МФО" maxlength={6} autocomplete="off" />
                </v-col>
              </v-row>
              <v-textarea v-model={form.paymentNotes} label="Додаткові реквізити" rows={2} hint="Напр., SWIFT, кореспондентський рахунок" persistent-hint class="mt-2" />
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
