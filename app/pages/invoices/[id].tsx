export default defineComponent({
  name: 'InvoiceDetailPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const route = useRoute()
    const { isPrivileged } = useAuth()
    const toast = useToast()
    const id = route.params.id as string
    const { data, pending, refresh } = useFetch(`/api/invoices/${id}`)
    const invoice = computed(() => (data.value as any)?.invoice)
    const router = useRouter()

    useHead({
      title: computed(() => invoice.value ? `Накладна №${invoice.value.number}` : 'Накладна')
    })

    const deleteDialog = ref(false)
    const deleting = ref(false)
    const pdfPreviewDialog = ref(false)
    const attachedPreviewDialog = ref(false)
    const attachInput = ref<HTMLInputElement | null>(null)
    const attaching = ref(false)
    const removingAttachment = ref(false)

    async function confirmDelete() {
      deleting.value = true
      try {
        await $fetch(`/api/invoices/${id}`, { method: 'DELETE' })
        toast.success('Накладну видалено')
        await router.push('/invoices')
      } catch (e: any) {
        toast.error(e?.data?.statusMessage || 'Помилка видалення')
      } finally {
        deleting.value = false
      }
    }

    function openAttachPicker() {
      attachInput.value?.click()
    }

    async function onAttachSelected(e: Event) {
      const input = e.target as HTMLInputElement
      const file = input.files?.[0]
      input.value = ''
      if (!file) return
      if (!/pdf/i.test(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('Виберіть PDF файл')
        return
      }
      attaching.value = true
      try {
        const fd = new FormData()
        fd.append('file', file, file.name)
        await $fetch(`/api/invoices/${id}/attachment`, { method: 'POST', body: fd })
        toast.success('PDF прикріплено')
        await refresh()
      } catch (err: any) {
        toast.error(err?.data?.statusMessage || 'Не вдалося прикріпити PDF')
      } finally {
        attaching.value = false
      }
    }

    async function removeAttachment() {
      removingAttachment.value = true
      try {
        await $fetch(`/api/invoices/${id}/attachment`, { method: 'DELETE' })
        toast.success('PDF прибрано')
        await refresh()
      } catch (err: any) {
        toast.error(err?.data?.statusMessage || 'Не вдалося прибрати PDF')
      } finally {
        removingAttachment.value = false
      }
    }

    const hasVat = computed(() =>
      (invoice.value?.items ?? []).some((i: any) => Number(i.vatPercent) > 0),
    )

    const itemHeaders = computed(() => {
      const headers: any[] = [
        { title: 'Товар', key: 'product.name' },
        { title: 'Артикул', key: 'product.sku', width: 120 },
        { title: 'Кількість', key: 'quantity', align: 'end' as const, width: 120 },
        { title: hasVat.value ? 'Ціна без ПДВ' : 'Ціна', key: 'pricePerUnit', align: 'end' as const, width: 130 },
      ]
      if (hasVat.value) {
        headers.push({ title: 'ПДВ', key: 'vatPercent', align: 'end' as const, width: 90 })
      }
      headers.push({ title: 'Сума', key: 'total', align: 'end' as const, width: 120 })
      return headers
    })

    const baseTotal = computed(() =>
      (invoice.value?.items ?? []).reduce(
        (s: number, i: any) => s + Number(i.quantity) * Number(i.pricePerUnit),
        0,
      ),
    )

    const vatTotal = computed(() =>
      (invoice.value?.items ?? []).reduce(
        (s: number, i: any) =>
          s + (Number(i.quantity) * Number(i.pricePerUnit) * Number(i.vatPercent || 0)) / 100,
        0,
      ),
    )

    const grandTotal = computed(() => baseTotal.value + vatTotal.value)

    function formatFileSize(bytes: number) {
      if (bytes < 1024) return `${bytes} Б`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
      return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`
    }

    return () => (
      <div>
        <div class="page-toolbar">
          <v-btn icon="mdi-arrow-left" variant="text" to="/invoices" class="mr-2" />
          {invoice.value && (
            <>
              <div class="text-h5 font-weight-bold">
                Накладна №{invoice.value.number}
              </div>
              <v-chip
                class="ml-3"
                color={invoice.value.type === 'INCOMING' ? 'success' : 'error'}
                variant="tonal"
              >
                {invoice.value.type === 'INCOMING' ? 'Прихід' : 'Видаток'}
              </v-chip>
            </>
          )}
          <v-spacer />
          {invoice.value && (
            <v-btn
              class="mr-2"
              variant="outlined"
              color="primary"
              prepend-icon="mdi-file-pdf-box"
              onClick={() => (pdfPreviewDialog.value = true)}
            >
            Переглянути PDF
            </v-btn>
          )}
          {isPrivileged.value && invoice.value && (
            <v-btn color="error" variant="outlined" prepend-icon="mdi-delete" onClick={() => (deleteDialog.value = true)}>
              Видалити
            </v-btn>
          )}
        </div>

        {pending.value && <v-progress-linear indeterminate color="primary" />}

        {invoice.value && (
          <v-row>
            <v-col cols={12} md={4}>
              <v-card class="mb-4">
                <v-list lines="two">
                  <v-list-item title="Дата" subtitle={new Date(invoice.value.date).toLocaleDateString('uk-UA')} prepend-icon="mdi-calendar" />
                  {invoice.value.warehouse && (
                    <v-list-item title="Склад" subtitle={invoice.value.warehouse.name} prepend-icon="mdi-warehouse" />
                  )}
                  {invoice.value.object && (
                    <v-list-item title="Обʼєкт" subtitle={invoice.value.object.name} prepend-icon="mdi-office-building" />
                  )}
                  <v-list-item title="Контрагент" subtitle={invoice.value.contractor?.name || '—'} prepend-icon="mdi-domain" />
                  <v-list-item title="Створив" subtitle={invoice.value.createdBy?.name} prepend-icon="mdi-account" />
                  {invoice.value.notes && (
                    <v-list-item title="Примітки" subtitle={invoice.value.notes} prepend-icon="mdi-note-text" />
                  )}
                </v-list>
              </v-card>

              <v-card class="mb-4">
                <v-card-title class="d-flex align-center">
                  <v-icon icon="mdi-paperclip" class="mr-2" />
                  Оригінал PDF
                </v-card-title>
                <v-card-text>
                  <input
                    ref={attachInput}
                    type="file"
                    accept="application/pdf,.pdf"
                    style="display: none"
                    onChange={onAttachSelected}
                  />
                  {invoice.value.pdfStoredAs ? (
                    <div>
                      <div class="d-flex align-center mb-3">
                        <v-icon icon="mdi-file-pdf-box" color="error" size="40" class="mr-3" />
                        <div class="flex-grow-1" style="min-width:0">
                          <div class="text-body-2 font-weight-medium text-truncate">
                            {invoice.value.pdfFilename || 'invoice.pdf'}
                          </div>
                          <div class="text-caption text-medium-emphasis">
                            {invoice.value.pdfSize ? formatFileSize(invoice.value.pdfSize) : ''}
                          </div>
                        </div>
                      </div>
                      <div class="d-flex flex-wrap gap-2">
                        <v-btn
                          size="small"
                          variant="elevated"
                          color="primary"
                          prepend-icon="mdi-eye"
                          onClick={() => (attachedPreviewDialog.value = true)}
                        >
                          Переглянути
                        </v-btn>
                        <v-btn
                          size="small"
                          variant="outlined"
                          prepend-icon="mdi-download"
                          tag="a"
                          href={`/api/invoices/${id}/attachment`}
                        >
                          Завантажити
                        </v-btn>
                        {isPrivileged.value && (
                          <>
                            <v-btn
                              size="small"
                              variant="text"
                              prepend-icon="mdi-refresh"
                              loading={attaching.value}
                              onClick={openAttachPicker}
                            >
                              Замінити
                            </v-btn>
                            <v-btn
                              size="small"
                              variant="text"
                              color="error"
                              prepend-icon="mdi-delete"
                              loading={removingAttachment.value}
                              onClick={removeAttachment}
                            >
                              Прибрати
                            </v-btn>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div class="text-body-2 text-medium-emphasis mb-3">
                        PDF не прикріплено
                      </div>
                      <v-btn
                        block
                        color="primary"
                        variant="elevated"
                        prepend-icon="mdi-upload"
                        loading={attaching.value}
                        onClick={openAttachPicker}
                      >
                        Прикріпити PDF
                      </v-btn>
                    </div>
                  )}
                </v-card-text>
              </v-card>
            </v-col>

            <v-col cols={12} md={8}>
              <v-card>
                <v-card-title>Позиції</v-card-title>
                <v-data-table headers={itemHeaders.value} items={invoice.value.items ?? []} hide-default-footer>
                  {{
                    'item.product.sku': ({ item }: any) => (
                      <span>{item.product?.sku || '—'}</span>
                    ),
                    'item.quantity': ({ item }: any) => (
                      <span>{Number(item.quantity).toLocaleString('uk-UA')} {item.product?.unit}</span>
                    ),
                    'item.pricePerUnit': ({ item }: any) => (
                      <span>₴{Number(item.pricePerUnit).toLocaleString('uk-UA', { minimumFractionDigits: 2 })}</span>
                    ),
                    'item.vatPercent': ({ item }: any) => (
                      <span>{Number(item.vatPercent || 0).toLocaleString('uk-UA')}%</span>
                    ),
                    'item.total': ({ item }: any) => (
                      <strong>₴{(Number(item.quantity) * Number(item.pricePerUnit)).toLocaleString('uk-UA', { minimumFractionDigits: 2 })}</strong>
                    ),
                    'body.append': () =>
                      hasVat.value ? (
                        <>
                          <tr>
                            <td colspan={5} class="text-right pa-3">Сума без ПДВ:</td>
                            <td class="text-right pa-3">₴{baseTotal.value.toLocaleString('uk-UA', { minimumFractionDigits: 2 })}</td>
                          </tr>
                          <tr>
                            <td colspan={5} class="text-right pa-3">ПДВ:</td>
                            <td class="text-right pa-3">₴{vatTotal.value.toLocaleString('uk-UA', { minimumFractionDigits: 2 })}</td>
                          </tr>
                          <tr>
                            <td colspan={5} class="text-right font-weight-bold pa-3">Всього з ПДВ:</td>
                            <td class="text-right font-weight-bold pa-3">₴{grandTotal.value.toLocaleString('uk-UA', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        </>
                      ) : (
                        <tr>
                          <td colspan={4} class="text-right font-weight-bold pa-3">Всього:</td>
                          <td class="text-right font-weight-bold pa-3">₴{baseTotal.value.toLocaleString('uk-UA', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ),
                  }}
                </v-data-table>
              </v-card>
            </v-col>
          </v-row>
        )}

        <v-dialog v-model={pdfPreviewDialog.value} max-width={960} scrollable>
          <v-card>
            <v-card-title class="d-flex align-center flex-wrap gap-2">
              <span>Перегляд PDF</span>
              <v-chip size="small" variant="tonal">
                №{invoice.value?.number}
              </v-chip>
              <v-spacer />
              <v-btn
                color="primary"
                variant="elevated"
                prepend-icon="mdi-download"
                tag="a"
                href={`/api/invoices/${id}/pdf`}
              >
                Завантажити PDF
              </v-btn>
              <v-btn variant="text" icon="mdi-close" aria-label="Закрити" onClick={() => (pdfPreviewDialog.value = false)} />
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-0 pdf-preview-dialog__body">
              {pdfPreviewDialog.value ? (
                <iframe
                  title="Перегляд накладної PDF"
                  src={`/api/invoices/${id}/pdf?inline=1`}
                  class="pdf-preview-dialog__iframe"
                />
              ) : null}
            </v-card-text>
          </v-card>
        </v-dialog>

        <v-dialog v-model={attachedPreviewDialog.value} max-width={960} scrollable>
          <v-card>
            <v-card-title class="d-flex align-center flex-wrap gap-2">
              <span>Оригінал накладної</span>
              <v-chip size="small" variant="tonal">
                {invoice.value?.pdfFilename}
              </v-chip>
              <v-spacer />
              <v-btn
                color="primary"
                variant="elevated"
                prepend-icon="mdi-download"
                tag="a"
                href={`/api/invoices/${id}/attachment`}
              >
                Завантажити
              </v-btn>
              <v-btn variant="text" icon="mdi-close" aria-label="Закрити" onClick={() => (attachedPreviewDialog.value = false)} />
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-0 pdf-preview-dialog__body">
              {attachedPreviewDialog.value ? (
                <iframe
                  title="Оригінал PDF"
                  src={`/api/invoices/${id}/attachment?inline=1`}
                  class="pdf-preview-dialog__iframe"
                />
              ) : null}
            </v-card-text>
          </v-card>
        </v-dialog>

        <v-dialog v-model={deleteDialog.value} max-width={400}>
          <v-card>
            <v-card-title>Видалити накладну?</v-card-title>
            <v-card-text>
              Накладну №{invoice.value?.number} буде видалено, залишки на складі будуть перераховані.
            </v-card-text>
            <v-card-actions class="pa-4 pt-0">
              <v-spacer />
              <v-btn variant="outlined" onClick={() => (deleteDialog.value = false)}>Скасувати</v-btn>
              <v-btn color="error" variant="elevated" loading={deleting.value} onClick={confirmDelete}>Видалити</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </div>
    )
  },
})
