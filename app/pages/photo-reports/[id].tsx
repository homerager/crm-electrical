const STAGE_LABELS: Record<string, string> = {
  BEFORE: 'До початку робіт',
  IN_PROGRESS: 'В процесі',
  AFTER: 'Після завершення',
}

const STAGE_COLORS: Record<string, string> = {
  BEFORE: 'warning',
  IN_PROGRESS: 'info',
  AFTER: 'success',
}

const STAGE_ICONS: Record<string, string> = {
  BEFORE: 'mdi-clock-outline',
  IN_PROGRESS: 'mdi-hammer-wrench',
  AFTER: 'mdi-check-circle-outline',
}

const STAGES = ['BEFORE', 'IN_PROGRESS', 'AFTER'] as const

export default defineComponent({
  name: 'PhotoReportDetailPage',
  setup() {
    definePageMeta({ middleware: ['auth'] })

    const route = useRoute()
    const reportId = route.params.id as string

    const { data, refresh, pending } = useFetch(`/api/photo-reports/${reportId}`)
    const report = computed(() => (data.value as any)?.report ?? null)

    useHead({ title: computed(() => report.value?.title ? `Фото-звіт: ${report.value.title}` : 'Фото-звіт') })

    const uploading = ref(false)
    const uploadStage = ref<string>('BEFORE')
    const uploadDescription = ref('')
    const uploadDialog = ref(false)
    const fileInput = ref<HTMLInputElement | null>(null)
    const selectedFiles = ref<File[]>([])

    const lightbox = ref(false)
    const lightboxIndex = ref(0)
    const lightboxPhotos = ref<any[]>([])

    const editPhotoDialog = ref(false)
    const editingPhoto = ref<any>(null)
    const editPhotoForm = reactive({ stage: '', description: '' })

    const deletePhotoDialog = ref(false)
    const deletingPhoto = ref<any>(null)

    const activeTab = ref('all')

    const photosByStage = computed(() => {
      const photos = report.value?.photos ?? []
      const grouped: Record<string, any[]> = { BEFORE: [], IN_PROGRESS: [], AFTER: [] }
      for (const p of photos) {
        if (grouped[p.stage]) grouped[p.stage].push(p)
        else grouped[p.stage] = [p]
      }
      return grouped
    })

    const displayPhotos = computed(() => {
      if (activeTab.value === 'all') return report.value?.photos ?? []
      return photosByStage.value[activeTab.value] ?? []
    })

    const stageCounts = computed(() => {
      const photos = report.value?.photos ?? []
      const counts: Record<string, number> = { all: photos.length, BEFORE: 0, IN_PROGRESS: 0, AFTER: 0 }
      for (const p of photos) {
        counts[p.stage] = (counts[p.stage] || 0) + 1
      }
      return counts
    })

    function photoUrl(photo: any) {
      return `/api/photo-reports/${reportId}/photos/${photo.id}`
    }

    function openUploadDialog() {
      selectedFiles.value = []
      uploadDescription.value = ''
      uploadDialog.value = true
    }

    function handleFileSelect(e: Event) {
      const input = e.target as HTMLInputElement
      if (input.files) {
        selectedFiles.value = Array.from(input.files)
      }
    }

    async function uploadPhotos() {
      if (!selectedFiles.value.length) return
      uploading.value = true
      try {
        const fd = new FormData()
        fd.append('stage', uploadStage.value)
        if (uploadDescription.value) fd.append('description', uploadDescription.value)
        for (const file of selectedFiles.value) {
          fd.append('files', file)
        }
        await $fetch(`/api/photo-reports/${reportId}/photos`, {
          method: 'POST',
          body: fd,
        })
        uploadDialog.value = false
        await refresh()
      } catch (e: any) {
        console.error('Upload error:', e)
      } finally {
        uploading.value = false
      }
    }

    function openLightbox(photo: any) {
      const photos = displayPhotos.value
      lightboxPhotos.value = photos
      lightboxIndex.value = photos.findIndex((p: any) => p.id === photo.id)
      lightbox.value = true
    }

    function lightboxPrev() {
      if (lightboxIndex.value > 0) lightboxIndex.value--
    }

    function lightboxNext() {
      if (lightboxIndex.value < lightboxPhotos.value.length - 1) lightboxIndex.value++
    }

    function openEditPhoto(photo: any) {
      editingPhoto.value = photo
      editPhotoForm.stage = photo.stage
      editPhotoForm.description = photo.description || ''
      editPhotoDialog.value = true
    }

    async function savePhotoEdit() {
      if (!editingPhoto.value) return
      try {
        await $fetch(`/api/photo-reports/${reportId}/photos/${editingPhoto.value.id}`, {
          method: 'PUT',
          body: editPhotoForm,
        })
        editPhotoDialog.value = false
        await refresh()
      } catch (e: any) {
        console.error('Edit error:', e)
      }
    }

    function openDeletePhoto(photo: any) {
      deletingPhoto.value = photo
      deletePhotoDialog.value = true
    }

    async function confirmDeletePhoto() {
      if (!deletingPhoto.value) return
      try {
        await $fetch(`/api/photo-reports/${reportId}/photos/${deletingPhoto.value.id}`, {
          method: 'DELETE',
        })
        deletePhotoDialog.value = false
        await refresh()
      } catch (e: any) {
        console.error('Delete error:', e)
      }
    }

    const currentLightboxPhoto = computed(() => lightboxPhotos.value[lightboxIndex.value] ?? null)

    return () => {
      if (pending.value && !report.value) {
        return (
          <div class="d-flex justify-center py-12">
            <v-progress-circular indeterminate size={48} />
          </div>
        )
      }

      if (!report.value) {
        return (
          <v-alert type="error" variant="tonal" class="ma-4">
            Фото-звіт не знайдено
          </v-alert>
        )
      }

      const r = report.value

      return (
        <div>
          {/* Header */}
          <div class="page-toolbar">
            <div>
              <v-btn variant="text" prepend-icon="mdi-arrow-left" to="/photo-reports" class="mb-1">
                Всі фото-звіти
              </v-btn>
              <div class="text-h5 font-weight-bold">{r.title}</div>
              <div class="text-body-2 text-medium-emphasis mt-1">
                Об'єкт: <strong>{r.object?.name}</strong>
                {r.object?.address && <span> — {r.object.address}</span>}
                {' | '}Автор: {r.createdBy?.name}
                {' | '}{new Date(r.createdAt).toLocaleDateString('uk-UA')}
              </div>
            </div>
            <v-spacer />
            <div class="d-flex gap-2">
              <v-btn
                color="error"
                variant="tonal"
                prepend-icon="mdi-file-pdf-box"
                href={`/api/photo-reports/${reportId}/pdf?inline=1`}
                target="_blank"
              >
                PDF
              </v-btn>
              <v-btn color="primary" prepend-icon="mdi-camera-plus" onClick={openUploadDialog}>
                Додати фото
              </v-btn>
            </div>
          </div>

          {r.description && (
            <v-alert type="info" variant="tonal" class="mb-4" icon="mdi-text-box-outline">
              {r.description}
            </v-alert>
          )}

          {/* Stage stats */}
          <v-row class="mb-4">
            {STAGES.map(stage => (
              <v-col key={stage} cols={12} sm={4}>
                <v-card variant="tonal" color={STAGE_COLORS[stage]}>
                  <v-card-text class="d-flex align-center">
                    <v-icon size="36" class="mr-3">{STAGE_ICONS[stage]}</v-icon>
                    <div>
                      <div class="text-h5 font-weight-bold">{stageCounts.value[stage] || 0}</div>
                      <div class="text-body-2">{STAGE_LABELS[stage]}</div>
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            ))}
          </v-row>

          {/* Tabs */}
          <v-card>
            <v-tabs v-model={activeTab.value} color="primary">
              <v-tab value="all">
                Всі ({stageCounts.value.all})
              </v-tab>
              {STAGES.map(stage => (
                <v-tab key={stage} value={stage}>
                  <v-icon size="small" class="mr-1">{STAGE_ICONS[stage]}</v-icon>
                  {STAGE_LABELS[stage]} ({stageCounts.value[stage] || 0})
                </v-tab>
              ))}
            </v-tabs>

            <v-card-text>
              {displayPhotos.value.length === 0 ? (
                <div class="text-center py-8 text-medium-emphasis">
                  <v-icon size="64" color="grey-lighten-1" class="mb-3">mdi-camera-off</v-icon>
                  <div class="text-h6">Фото відсутні</div>
                  <div class="text-body-2 mt-1">Натисніть "Додати фото" щоб завантажити зображення</div>
                </div>
              ) : (
                <v-row>
                  {displayPhotos.value.map((photo: any) => (
                    <v-col key={photo.id} cols={12} sm={6} md={4} lg={3}>
                      <v-card variant="outlined" class="photo-card">
                        <div
                          class="photo-thumb"
                          style={{ cursor: 'pointer', position: 'relative', paddingTop: '75%', overflow: 'hidden' }}
                          onClick={() => openLightbox(photo)}
                        >
                          <img
                            src={photoUrl(photo)}
                            alt={photo.description || photo.filename}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                            loading="lazy"
                          />
                          <v-chip
                            size="x-small"
                            color={STAGE_COLORS[photo.stage]}
                            variant="elevated"
                            style={{ position: 'absolute', top: '8px', left: '8px' }}
                          >
                            {STAGE_LABELS[photo.stage]}
                          </v-chip>
                        </div>
                        <v-card-text class="pa-3">
                          {photo.description && (
                            <div class="text-body-2 mb-1 text-truncate">{photo.description}</div>
                          )}
                          <div class="text-caption text-medium-emphasis">
                            {photo.takenAt
                              ? new Date(photo.takenAt).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })
                              : new Date(photo.createdAt).toLocaleDateString('uk-UA')
                            }
                            {photo.latitude != null && photo.longitude != null && (
                              <span> | GPS</span>
                            )}
                          </div>
                        </v-card-text>
                        <v-card-actions class="pt-0">
                          <v-btn icon="mdi-pencil" variant="text" size="small" color="primary" onClick={() => openEditPhoto(photo)} title="Редагувати" />
                          <v-btn icon="mdi-delete" variant="text" size="small" color="error" onClick={() => openDeletePhoto(photo)} title="Видалити" />
                          <v-spacer />
                          <v-btn
                            icon="mdi-download"
                            variant="text"
                            size="small"
                            href={photoUrl(photo)}
                            download={photo.filename}
                            title="Завантажити"
                          />
                        </v-card-actions>
                      </v-card>
                    </v-col>
                  ))}
                </v-row>
              )}
            </v-card-text>
          </v-card>

          {/* Upload dialog */}
          <v-dialog v-model={uploadDialog.value} max-width={500}>
            <v-card>
              <v-card-title>Додати фото</v-card-title>
              <v-card-text>
                <v-select
                  v-model={uploadStage.value}
                  label="Етап"
                  items={STAGES.map(s => ({ title: STAGE_LABELS[s], value: s }))}
                  item-title="title"
                  item-value="value"
                  prepend-inner-icon="mdi-tag-outline"
                  class="mb-3"
                />
                <v-textarea
                  v-model={uploadDescription.value}
                  label="Опис (необов'язково)"
                  rows={2}
                  class="mb-3"
                />
                <v-file-input
                  label="Оберіть фото"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  prepend-icon="mdi-camera"
                  show-size
                  onChange={handleFileSelect}
                  ref={fileInput}
                />
                {selectedFiles.value.length > 0 && (
                  <div class="text-body-2 text-medium-emphasis mt-2">
                    Обрано файлів: {selectedFiles.value.length}
                  </div>
                )}
              </v-card-text>
              <v-card-actions class="pa-4 pt-0">
                <v-spacer />
                <v-btn variant="outlined" onClick={() => (uploadDialog.value = false)}>Скасувати</v-btn>
                <v-btn
                  color="primary"
                  variant="elevated"
                  loading={uploading.value}
                  disabled={!selectedFiles.value.length}
                  onClick={uploadPhotos}
                >
                  Завантажити
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>

          {/* Edit photo dialog */}
          <v-dialog v-model={editPhotoDialog.value} max-width={450}>
            <v-card>
              <v-card-title>Редагувати фото</v-card-title>
              <v-card-text>
                <v-select
                  v-model={editPhotoForm.stage}
                  label="Етап"
                  items={STAGES.map(s => ({ title: STAGE_LABELS[s], value: s }))}
                  item-title="title"
                  item-value="value"
                  class="mb-3"
                />
                <v-textarea
                  v-model={editPhotoForm.description}
                  label="Опис"
                  rows={2}
                />
              </v-card-text>
              <v-card-actions class="pa-4 pt-0">
                <v-spacer />
                <v-btn variant="outlined" onClick={() => (editPhotoDialog.value = false)}>Скасувати</v-btn>
                <v-btn color="primary" variant="elevated" onClick={savePhotoEdit}>Зберегти</v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>

          {/* Delete photo dialog */}
          <v-dialog v-model={deletePhotoDialog.value} max-width={400}>
            <v-card>
              <v-card-title>Видалити фото?</v-card-title>
              <v-card-text>Фото "{deletingPhoto.value?.filename}" буде видалено назавжди.</v-card-text>
              <v-card-actions class="pa-4 pt-0">
                <v-spacer />
                <v-btn variant="outlined" onClick={() => (deletePhotoDialog.value = false)}>Скасувати</v-btn>
                <v-btn color="error" variant="elevated" onClick={confirmDeletePhoto}>Видалити</v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>

          {/* Lightbox */}
          <v-dialog v-model={lightbox.value} max-width={1200} content-class="lightbox-dialog">
            <v-card color="black" class="rounded-lg">
              <div class="d-flex align-center pa-3">
                <v-chip size="small" color={STAGE_COLORS[currentLightboxPhoto.value?.stage]} variant="elevated" class="mr-2">
                  {STAGE_LABELS[currentLightboxPhoto.value?.stage] ?? ''}
                </v-chip>
                <span class="text-body-2 text-white text-truncate" style={{ flex: 1 }}>
                  {currentLightboxPhoto.value?.description || currentLightboxPhoto.value?.filename || ''}
                </span>
                <span class="text-body-2 text-grey-lighten-1 mx-3">
                  {lightboxIndex.value + 1} / {lightboxPhotos.value.length}
                </span>
                <v-btn icon="mdi-close" variant="text" color="white" size="small" onClick={() => (lightbox.value = false)} />
              </div>

              <div class="d-flex align-center justify-center" style={{ position: 'relative', minHeight: '400px' }}>
                <v-btn
                  icon="mdi-chevron-left"
                  variant="text"
                  color="white"
                  size="large"
                  disabled={lightboxIndex.value === 0}
                  onClick={lightboxPrev}
                  style={{ position: 'absolute', left: '8px', zIndex: 1 }}
                />

                {currentLightboxPhoto.value && (
                  <img
                    src={photoUrl(currentLightboxPhoto.value)}
                    alt={currentLightboxPhoto.value.description || ''}
                    style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                  />
                )}

                <v-btn
                  icon="mdi-chevron-right"
                  variant="text"
                  color="white"
                  size="large"
                  disabled={lightboxIndex.value >= lightboxPhotos.value.length - 1}
                  onClick={lightboxNext}
                  style={{ position: 'absolute', right: '8px', zIndex: 1 }}
                />
              </div>

              {currentLightboxPhoto.value && (
                <div class="pa-3 text-center">
                  {currentLightboxPhoto.value.takenAt && (
                    <div class="text-caption text-grey-lighten-1">
                      Дата зйомки: {new Date(currentLightboxPhoto.value.takenAt).toLocaleString('uk-UA')}
                    </div>
                  )}
                  {currentLightboxPhoto.value.latitude != null && currentLightboxPhoto.value.longitude != null && (
                    <div class="text-caption text-grey-lighten-1">
                      GPS: {currentLightboxPhoto.value.latitude.toFixed(6)}, {currentLightboxPhoto.value.longitude.toFixed(6)}
                    </div>
                  )}
                </div>
              )}
            </v-card>
          </v-dialog>
        </div>
      )
    }
  },
})
