const emptyReqForm = () => ({
  name: '',
  companyName: '',
  taxCode: '',
  iban: '',
  bankName: '',
  bankMfo: '',
  address: '',
  phone: '',
  email: '',
  isDefault: false,
})

export default defineComponent({
  name: 'SettingsPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })
    useHead({ title: 'Налаштування CRM' })

    const { isAdmin } = useAuth()

    // ── Markup settings ──────────────────────────────────────
    const markupLoading = ref(true)
    const markupSaving = ref(false)
    const markupSaved = ref(false)
    const markupError = ref('')

    const markupForm = reactive({
      defaultMaterialMarkupPercent: '' as string | number,
      defaultLaborMarkupPercent: '' as string | number,
    })

    async function loadMarkup() {
      markupLoading.value = true
      try {
        const data = await $fetch<{ settings: any }>('/api/settings')
        const s = data.settings
        if (s) {
          markupForm.defaultMaterialMarkupPercent = s.defaultMaterialMarkupPercent != null ? Number(s.defaultMaterialMarkupPercent) : ''
          markupForm.defaultLaborMarkupPercent = s.defaultLaborMarkupPercent != null ? Number(s.defaultLaborMarkupPercent) : ''
        }
      } catch {
        markupError.value = 'Помилка завантаження налаштувань'
      } finally {
        markupLoading.value = false
      }
    }

    async function saveMarkup() {
      markupSaving.value = true
      markupError.value = ''
      markupSaved.value = false
      try {
        await $fetch('/api/settings', { method: 'PUT', body: markupForm })
        markupSaved.value = true
        setTimeout(() => { markupSaved.value = false }, 3000)
      } catch (e: any) {
        markupError.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        markupSaving.value = false
      }
    }

    // ── Requisites ────────────────────────────────────────────
    const { data: reqData, refresh: refreshReq, pending: reqPending } = useFetch('/api/requisites')
    const requisites = computed(() => (reqData.value as any)?.requisites ?? [])

    const reqDialog = ref(false)
    const deleteDialog = ref(false)
    const reqSaving = ref(false)
    const reqError = ref('')
    const editReq = ref<any>(null)
    const deleteReq = ref<any>(null)

    const reqForm = reactive(emptyReqForm())

    function openCreateReq() {
      editReq.value = null
      Object.assign(reqForm, emptyReqForm())
      reqError.value = ''
      reqDialog.value = true
    }

    function openEditReq(item: any) {
      editReq.value = item
      Object.assign(reqForm, {
        name: item.name,
        companyName: item.companyName ?? '',
        taxCode: item.taxCode ?? '',
        iban: item.iban ?? '',
        bankName: item.bankName ?? '',
        bankMfo: item.bankMfo ?? '',
        address: item.address ?? '',
        phone: item.phone ?? '',
        email: item.email ?? '',
        isDefault: item.isDefault,
      })
      reqError.value = ''
      reqDialog.value = true
    }

    function openDeleteReq(item: any) {
      deleteReq.value = item
      deleteDialog.value = true
    }

    async function saveReq() {
      reqSaving.value = true
      reqError.value = ''
      try {
        if (editReq.value) {
          await $fetch(`/api/requisites/${editReq.value.id}`, { method: 'PUT', body: reqForm })
        } else {
          await $fetch('/api/requisites', { method: 'POST', body: reqForm })
        }
        reqDialog.value = false
        await refreshReq()
      } catch (e: any) {
        reqError.value = e?.data?.statusMessage || 'Помилка збереження'
      } finally {
        reqSaving.value = false
      }
    }

    async function confirmDeleteReq() {
      if (!deleteReq.value) return
      try {
        await $fetch(`/api/requisites/${deleteReq.value.id}`, { method: 'DELETE' })
        deleteDialog.value = false
        await refreshReq()
      } catch (e: any) {
        reqError.value = e?.data?.statusMessage || 'Помилка видалення'
      }
    }

    async function setDefault(item: any) {
      try {
        await $fetch(`/api/requisites/${item.id}`, { method: 'PUT', body: { ...item, isDefault: true } })
        await refreshReq()
      } catch { /* ignore */ }
    }

    onMounted(loadMarkup)

    return () => {
      if (!isAdmin.value) {
        return (
          <v-container class="fill-height" style={{ maxWidth: '480px' }}>
            <v-alert type="error" variant="tonal" icon="mdi-lock">Доступ лише для адміністратора</v-alert>
          </v-container>
        )
      }

      return (
        <div>
          <div class="page-toolbar">
            <v-icon icon="mdi-cog-outline" size="28" class="mr-2" />
            <div class="text-h5 font-weight-bold">Налаштування CRM</div>
          </div>

          <v-row>
            {/* ── Реквізити ── */}
            <v-col cols={12} lg={8}>
              <v-card class="mb-4">
                <v-card-title class="d-flex align-center">
                  <v-icon icon="mdi-bank-outline" color="primary" class="mr-2" />
                  Реквізити для отримання оплати
                  <v-spacer />
                  <v-btn color="primary" variant="elevated" prepend-icon="mdi-plus" size="small" onClick={openCreateReq}>
                    Додати
                  </v-btn>
                </v-card-title>
                <v-card-subtitle class="pb-2">
                  Набори реквізитів виконавця, що використовуються в документах. Типовий набір підтягується автоматично.
                </v-card-subtitle>

                {reqPending.value && (
                  <v-card-text>
                    <v-progress-linear indeterminate color="primary" />
                  </v-card-text>
                )}

                {!reqPending.value && requisites.value.length === 0 && (
                  <v-card-text>
                    <v-alert type="info" variant="tonal" icon="mdi-information-outline">
                      Реквізитів ще немає. Додайте перший набір.
                    </v-alert>
                  </v-card-text>
                )}

                {requisites.value.length > 0 && (
                  <v-list lines="two">
                    {requisites.value.map((r: any, idx: number) => (
                      <>
                        {idx > 0 && <v-divider key={`d-${r.id}`} />}
                        <v-list-item key={r.id}>
                          {{
                            prepend: () => (
                              <v-avatar color={r.isDefault ? 'primary' : 'grey'} variant="tonal" size={40} class="mr-2">
                                <v-icon icon="mdi-bank-outline" size={20} />
                              </v-avatar>
                            ),
                            default: () => (
                              <div>
                                <div class="d-flex align-center gap-2 flex-wrap">
                                  <span class="font-weight-medium">{r.name}</span>
                                  {r.isDefault && (
                                    <v-chip size="x-small" color="primary" variant="tonal">Типовий</v-chip>
                                  )}
                                </div>
                                <div class="text-caption text-medium-emphasis">
                                  {[r.companyName, r.taxCode ? `ЄДРПОУ/ІПН: ${r.taxCode}` : null, r.iban ? `IBAN: ${r.iban}` : null, r.bankName].filter(Boolean).join(' · ')}
                                </div>
                                {(r.phone || r.email) && (
                                  <div class="text-caption text-medium-emphasis">
                                    {[r.phone, r.email].filter(Boolean).join(' · ')}
                                  </div>
                                )}
                              </div>
                            ),
                            append: () => (
                              <div class="d-flex gap-1">
                                {!r.isDefault && (
                                  <v-btn
                                    icon="mdi-star-outline"
                                    variant="text"
                                    size="small"
                                    color="warning"
                                    title="Зробити типовим"
                                    onClick={() => setDefault(r)}
                                  />
                                )}
                                <v-btn icon="mdi-pencil" variant="text" size="small" color="primary" onClick={() => openEditReq(r)} />
                                <v-btn icon="mdi-delete" variant="text" size="small" color="error" onClick={() => openDeleteReq(r)} />
                              </div>
                            ),
                          }}
                        </v-list-item>
                      </>
                    ))}
                  </v-list>
                )}
              </v-card>

              {/* ── Загальна націнка ── */}
              <v-card class="mb-4">
                <v-card-title class="d-flex align-center">
                  <v-icon icon="mdi-percent" color="orange" class="mr-2" />
                  Загальна націнка
                </v-card-title>
                <v-card-subtitle class="pb-0">
                  Застосовується до кошторисів та актів, якщо на конкретному об'єкті націнку не задано
                </v-card-subtitle>

                {markupLoading.value ? (
                  <v-card-text><v-progress-linear indeterminate color="primary" /></v-card-text>
                ) : (
                  <v-card-text class="pt-4">
                    {markupError.value && (
                      <v-alert type="error" variant="tonal" class="mb-4" closable onUpdate:modelValue={() => (markupError.value = '')}>
                        {markupError.value}
                      </v-alert>
                    )}
                    {markupSaved.value && (
                      <v-alert type="success" variant="tonal" class="mb-4" icon="mdi-check-circle">
                        Збережено
                      </v-alert>
                    )}

                    <v-row>
                      <v-col cols={12} md={6}>
                        <v-text-field
                          v-model={markupForm.defaultMaterialMarkupPercent}
                          label="Націнка на матеріали, %"
                          type="number"
                          min={0}
                          max={999}
                          step={0.01}
                          prepend-inner-icon="mdi-package-variant"
                          variant="outlined"
                          density="comfortable"
                          hint="Множиться на ціну кожного матеріалу"
                          persistent-hint
                        />
                      </v-col>
                      <v-col cols={12} md={6}>
                        <v-text-field
                          v-model={markupForm.defaultLaborMarkupPercent}
                          label="Націнка на роботи, %"
                          type="number"
                          min={0}
                          max={999}
                          step={0.01}
                          prepend-inner-icon="mdi-account-hard-hat-outline"
                          variant="outlined"
                          density="comfortable"
                          hint="Множиться на ставку та суму кожного працівника"
                          persistent-hint
                        />
                      </v-col>
                    </v-row>

                    <v-alert type="info" variant="tonal" density="compact" class="mt-2 mb-4" icon="mdi-information-outline">
                      Якщо для будівельного об'єкта задана власна «Націнка %» — вона перекриває обидва глобальні значення.
                    </v-alert>

                    <div class="d-flex justify-end">
                      <v-btn
                        color="primary"
                        variant="elevated"
                        prepend-icon="mdi-content-save-outline"
                        loading={markupSaving.value}
                        onClick={saveMarkup}
                      >
                        Зберегти
                      </v-btn>
                    </div>
                  </v-card-text>
                )}
              </v-card>
            </v-col>

            {/* ── Довідка пріоритету ── */}
            <v-col cols={12} lg={4}>
              <v-card variant="tonal" color="surface">
                <v-card-title class="text-subtitle-1 font-weight-bold">
                  <v-icon icon="mdi-information-outline" size="18" class="mr-1" />
                  Пріоритет націнки
                </v-card-title>
                <v-card-text>
                  <v-timeline side="end" density="compact" truncate-line="both">
                    <v-timeline-item dot-color="primary" size="small">
                      {{
                        default: () => (
                          <div>
                            <div class="font-weight-medium">Об'єктна націнка</div>
                            <div class="text-caption text-medium-emphasis">
                              «Націнка %» на картці об'єкта — застосовується до матеріалів та робіт замість глобальних
                            </div>
                          </div>
                        ),
                      }}
                    </v-timeline-item>
                    <v-timeline-item dot-color="orange" size="small">
                      {{
                        default: () => (
                          <div>
                            <div class="font-weight-medium">Глобальна націнка</div>
                            <div class="text-caption text-medium-emphasis">
                              Якщо об'єктна не задана — окремо «на матеріали» і «на роботи» з цієї сторінки
                            </div>
                          </div>
                        ),
                      }}
                    </v-timeline-item>
                    <v-timeline-item dot-color="grey" size="small">
                      {{
                        default: () => (
                          <div>
                            <div class="font-weight-medium">Без націнки</div>
                            <div class="text-caption text-medium-emphasis">
                              Ціни з накладних та облік часу без змін
                            </div>
                          </div>
                        ),
                      }}
                    </v-timeline-item>
                  </v-timeline>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          {/* ── Діалог реквізитів ── */}
          <v-dialog v-model={reqDialog.value} max-width={600} persistent>
            <v-card>
              <v-card-title>{editReq.value ? 'Редагувати реквізити' : 'Нові реквізити'}</v-card-title>
              <v-card-text>
                {reqError.value && <v-alert type="error" variant="tonal" class="mb-3">{reqError.value}</v-alert>}

                <v-text-field
                  v-model={reqForm.name}
                  label="Назва набору реквізитів *"
                  placeholder="напр. ФОП Іванов І.І."
                  class="mb-3"
                  variant="outlined"
                  density="comfortable"
                />

                <v-row>
                  <v-col cols={12} md={6}>
                    <v-text-field
                      v-model={reqForm.companyName}
                      label="Назва компанії / ФОП"
                      prepend-inner-icon="mdi-domain"
                      variant="outlined"
                      density="comfortable"
                    />
                  </v-col>
                  <v-col cols={12} md={6}>
                    <v-text-field
                      v-model={reqForm.taxCode}
                      label="ЄДРПОУ / ІПН"
                      prepend-inner-icon="mdi-identifier"
                      variant="outlined"
                      density="comfortable"
                    />
                  </v-col>
                  <v-col cols={12}>
                    <v-text-field
                      v-model={reqForm.iban}
                      label="IBAN"
                      prepend-inner-icon="mdi-credit-card-outline"
                      variant="outlined"
                      density="comfortable"
                      placeholder="UA..."
                    />
                  </v-col>
                  <v-col cols={12} md={6}>
                    <v-text-field
                      v-model={reqForm.bankName}
                      label="Назва банку"
                      prepend-inner-icon="mdi-bank"
                      variant="outlined"
                      density="comfortable"
                    />
                  </v-col>
                  <v-col cols={12} md={6}>
                    <v-text-field
                      v-model={reqForm.bankMfo}
                      label="МФО банку"
                      prepend-inner-icon="mdi-pound"
                      variant="outlined"
                      density="comfortable"
                    />
                  </v-col>
                  <v-col cols={12}>
                    <v-text-field
                      v-model={reqForm.address}
                      label="Адреса"
                      prepend-inner-icon="mdi-map-marker-outline"
                      variant="outlined"
                      density="comfortable"
                    />
                  </v-col>
                  <v-col cols={12} md={6}>
                    <v-text-field
                      v-model={reqForm.phone}
                      label="Телефон"
                      prepend-inner-icon="mdi-phone-outline"
                      variant="outlined"
                      density="comfortable"
                    />
                  </v-col>
                  <v-col cols={12} md={6}>
                    <v-text-field
                      v-model={reqForm.email}
                      label="Email"
                      type="email"
                      prepend-inner-icon="mdi-email-outline"
                      variant="outlined"
                      density="comfortable"
                    />
                  </v-col>
                </v-row>

                <v-checkbox
                  v-model={reqForm.isDefault}
                  label="Типовий набір реквізитів"
                  color="primary"
                  hint="Буде використовуватися в документах за замовчуванням"
                  persistent-hint
                />
              </v-card-text>
              <v-card-actions class="pa-4 pt-0">
                <v-spacer />
                <v-btn variant="outlined" onClick={() => (reqDialog.value = false)}>Скасувати</v-btn>
                <v-btn
                  color="primary"
                  variant="elevated"
                  loading={reqSaving.value}
                  disabled={!reqForm.name}
                  onClick={saveReq}
                >
                  {editReq.value ? 'Зберегти' : 'Створити'}
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>

          {/* ── Діалог видалення ── */}
          <v-dialog v-model={deleteDialog.value} max-width={400}>
            <v-card>
              <v-card-title>Видалити реквізити?</v-card-title>
              <v-card-text>Набір «{deleteReq.value?.name}» буде видалено.</v-card-text>
              <v-card-actions class="pa-4 pt-0">
                <v-spacer />
                <v-btn variant="outlined" onClick={() => (deleteDialog.value = false)}>Скасувати</v-btn>
                <v-btn color="error" variant="elevated" onClick={confirmDeleteReq}>Видалити</v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
        </div>
      )
    }
  },
})
