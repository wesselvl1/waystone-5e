<script setup lang="ts">
/**
 * A confirmation the app owns, rather than `window.confirm()`.
 *
 * The native dialog can be switched off by the browser — Firefox offers "prevent this
 * page from creating additional dialogs" as soon as two appear in quick succession, and
 * from then on `confirm()` returns false without showing anything. Every call site reads
 * that as "the user said no", so deleting quietly stopped working with nothing on screen
 * to explain it. Nothing here can be suppressed.
 */
const props = withDefaults(defineProps<{
  /** Whether the dialog is on screen; the parent owns this. */
  open: boolean
  title: string
  /** The consequence, in the words the user needs to decide. */
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Paints the confirm button as destructive, which is the usual case here. */
  danger?: boolean
}>(), {
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  danger: false,
})

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const confirmButton = ref<HTMLButtonElement | null>(null)

// Focus follows the dialog, so Enter and Escape reach it rather than whatever was
// focused underneath — and so a screen reader announces the question.
watch(() => props.open, async (open) => {
  if (!open) return
  await nextTick()
  confirmButton.value?.focus()
})

/**
 * Escape is bound to the window, not the dialog.
 *
 * A listener on the overlay only fires while focus is inside it, which it is not once
 * the viewer clicks the backdrop or the page behind — the very moments someone reaches
 * for Escape. The listener lives only while the dialog is open, so it cannot swallow
 * Escape from anything else.
 */
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('cancel')
}

watch(() => props.open, (open) => {
  if (open) window.addEventListener('keydown', onKeydown)
  else window.removeEventListener('keydown', onKeydown)
}, { immediate: true })

onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @click.self="emit('cancel')"
      >
        <div
          class="bg-surface-800 border border-surface-600 w-full sm:w-auto sm:max-w-sm
            rounded-t-2xl sm:rounded-xl shadow-xl p-4 space-y-3"
        >
          <p class="text-base font-semibold text-white leading-tight">{{ title }}</p>
          <p v-if="message" class="text-sm text-slate-400">{{ message }}</p>

          <!-- Cancel first: it is the safe answer, and on a phone it sits under the thumb -->
          <div class="flex gap-2 pt-1">
            <button class="btn-ghost flex-1" @click="emit('cancel')">{{ cancelLabel }}</button>
            <button
              ref="confirmButton"
              class="flex-1"
              :class="danger ? 'btn bg-danger-500 text-white hover:bg-danger-400' : 'btn-primary'"
              @click="emit('confirm')"
            >{{ confirmLabel }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
