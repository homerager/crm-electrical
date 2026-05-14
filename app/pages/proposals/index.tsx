export default defineComponent({
  name: 'ProposalsPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })
    useHead({ title: 'Комерційні пропозиції' })

    const { isPrivileged } = useAuth()
    const { data, refresh, pending } = useFetch('/api/proposals')
    const proposals = computed(() => (data.value as any)?.proposals ?? [])

    const search = ref('')
    const filtered = computed(() => {
      if (!search.value) return proposals.value
      const q = search.value.toLowerCase()
      return proposals.value.filter((p: any) =>
        p.title.toLowerCase().includes(q) ||
        (p.subtitle || '').toLowerCase().includes(q),
      )
    })

    const duplicatingId = ref<string | null>(null)

    async function duplicate(item: any) {
      duplicatingId.value = item.id
      try {
        const res = await $fetch(`/api/proposals/${item.id}/duplicate`, { method: 'POST' }) as any
        await navigateTo(`/proposals/${res.proposal.id}`)
      } catch (e: any) {
        alert(e?.data?.statusMessage || 'Помилка дублювання')
      } finally {
        duplicatingId.value = null
      }
    }

    const deleteDialog = ref(false)
    const deleteItem = ref<any>(null)
    const deleteError = ref('')

    function openDelete(item: any) {
      deleteItem.value = item
      deleteError.value = ''
      deleteDialog.value = true
    }

    async function confirmDelete() {
      if (!deleteItem.value) return
      deleteError.value = ''
      try {
        await $fetch(`/api/proposals/${deleteItem.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        await refresh()
      } catch (e: any) {
        deleteError.value = e?.data?.statusMessage || 'Помилка видалення'
      }
    }

    const downloadingId = ref<string | null>(null)

    async function downloadPdf(item: any) {
      downloadingId.value = item.id
      try {
        const blob = await $fetch(`/api/proposals/${item.id}/pdf`, { responseType: 'blob' }) as Blob
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `КП_${item.title.slice(0, 40)}.pdf`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 30_000)
      } catch (e: any) {
        alert(e?.data?.statusMessage || 'Помилка генерації PDF')
      } finally {
        downloadingId.value = null
      }
    }

    function fmtMoney(n: number) {
      return n.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    function fmtDate(d: string) {
      return new Date(d).toLocaleDateString('uk-UA')
    }

    const headers = [
      { title: 'Назва', key: 'title' },
      { title: 'Дата', key: 'date', width: 110 },
      { title: 'Позицій', key: 'items', sortable: false, align: 'center' as const, width: 90 },
      { title: 'Сума без ПДВ', key: 'totalExVat', sortable: false, align: 'end' as const, width: 140 },
      { title: 'Сума з ПДВ', key: 'totalWithVat', sortable: false, align: 'end' as const, width: 140 },
      { title: 'Реквізити', key: 'requisite', sortable: false },
      { title: 'Дії', key: 'actions', sortable: false, align: 'end' as const, width: 160 },
    ]

    return () => (
      <div>
        <div class="page-toolbar">
          <div class="text-h5 font-weight-bold">Комерційні пропозиції</div>
          <v-spacer />
          <v-btn
            variant="outlined"
            to="/proposals/products"
            prepend-icon="mdi-tag-multiple"
            class="mr-2"
          >
            Товари КП
          </v-btn>
          {isPrivileged.value && (
            <v-btn color="primary" prepend-icon="mdi-plus" to="/proposals/new">
              Нова КП
            </v-btn>
          )}
        </div>

        <v-card>
          <v-card-text class="pb-0">
            <v-text-field
              v-model={search.value}
              label="Пошук"
              prepend-inner-icon="mdi-magnify"
              clearable
              hide-details
              density="compact"
              style="max-width:360px"
            />
          </v-card-text>

          <v-data-table
            headers={headers}
            items={filtered.value}
            loading={pending.value}
            hover
            items-per-page={20}
          >
            {{
              'item.title': ({ item }: any) => (
                <div>
                  <div class="font-weight-medium">
                    <router-link to={`/proposals/${item.id}`} class="text-primary text-decoration-none">
                      {item.title}
                    </router-link>
                  </div>
                  {item.subtitle && (
                    <div class="text-caption text-medium-emphasis">{item.subtitle}</div>
                  )}
                </div>
              ),
              'item.date': ({ item }: any) => fmtDate(item.date),
              'item.items': ({ item }: any) => (
                <v-chip size="small" color="primary" variant="tonal">
                  {item.items?.length ?? 0}
                </v-chip>
              ),
              'item.totalExVat': ({ item }: any) => (
                <span class="text-body-2">{fmtMoney(item.totalExVat)} грн</span>
              ),
              'item.totalWithVat': ({ item }: any) => (
                <span class="font-weight-bold">{fmtMoney(item.totalWithVat)} грн</span>
              ),
              'item.requisite': ({ item }: any) => (
                item.requisite
                  ? <v-chip size="small" variant="tonal">{item.requisite.name}</v-chip>
                  : <span class="text-medium-emphasis">—</span>
              ),
              'item.actions': ({ item }: any) => (
                <div class="d-flex gap-1 justify-end">
                  <v-tooltip text="Завантажити PDF">
                    {{
                      activator: ({ props }: any) => (
                        <v-btn
                          {...props}
                          icon="mdi-file-pdf-box"
                          variant="text"
                          size="small"
                          color="error"
                          loading={downloadingId.value === item.id}
                          onClick={() => downloadPdf(item)}
                        />
                      ),
                    }}
                  </v-tooltip>
                  <v-tooltip text="Редагувати">
                    {{
                      activator: ({ props }: any) => (
                        <v-btn
                          {...props}
                          icon="mdi-pencil"
                          variant="text"
                          size="small"
                          color="primary"
                          to={`/proposals/${item.id}`}
                        />
                      ),
                    }}
                  </v-tooltip>
                  <v-tooltip text="Дублювати">
                    {{
                      activator: ({ props }: any) => (
                        <v-btn
                          {...props}
                          icon="mdi-content-copy"
                          variant="text"
                          size="small"
                          color="secondary"
                          loading={duplicatingId.value === item.id}
                          onClick={() => duplicate(item)}
                        />
                      ),
                    }}
                  </v-tooltip>
                  {isPrivileged.value && (
                    <v-tooltip text="Видалити">
                      {{
                        activator: ({ props }: any) => (
                          <v-btn
                            {...props}
                            icon="mdi-delete"
                            variant="text"
                            size="small"
                            color="error"
                            onClick={() => openDelete(item)}
                          />
                        ),
                      }}
                    </v-tooltip>
                  )}
                </div>
              ),
            }}
          </v-data-table>
        </v-card>

        <v-dialog v-model={deleteDialog.value} max-width={420}>
          <v-card>
            <v-card-title>Видалити КП?</v-card-title>
            <v-card-text>
              {deleteError.value
                ? <v-alert type="error" variant="tonal">{deleteError.value}</v-alert>
                : <span>«{deleteItem.value?.title}» буде видалено разом із усіма позиціями.</span>
              }
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (deleteDialog.value = false)}>Скасувати</v-btn>
              {!deleteError.value && (
                <v-btn color="error" variant="elevated" onClick={confirmDelete}>Видалити</v-btn>
              )}
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>
    )
  },
})
