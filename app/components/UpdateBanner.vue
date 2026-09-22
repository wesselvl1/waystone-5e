<script setup lang="ts">
/**
 * Says a new build is waiting, and never applies one on its own.
 *
 * Sits above the bottom nav rather than over the page, so it cannot cover what someone is
 * reading mid-session. "Later" hides it for this launch only — see `dismiss()` in
 * `usePwaUpdate` — and the About page keeps the button either way, so waving it off is
 * never the last chance to update.
 */
import {
  UPDATE_CONFIRM_MESSAGE,
  UPDATE_CONFIRM_TITLE,
  usePwaUpdate,
} from '~/composables/usePwaUpdate'

const { showBanner, dismiss, applyUpdate } = usePwaUpdate()

const confirming = ref(false)
</script>

<template>
  <div>
    <Transition name="fade">
      <div
        v-if="showBanner"
        class="fixed bottom-16 inset-x-0 z-40 px-2 pb-2"
        role="status"
      >
        <div
          class="mx-auto max-w-lg flex items-center gap-3 rounded-xl border border-primary-600/40
            bg-surface-800/95 backdrop-blur px-3 py-2.5 shadow-lg shadow-black/40"
        >
          <svg class="w-5 h-5 flex-shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M20 20v-5h-5" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M20 9A8 8 0 006.34 6.34L4 9m0 6a8 8 0 0013.66 2.66L20 15" />
          </svg>

          <!-- One line, no subtitle: at 375px a second line wraps to three and doubles the
               bar's height over whatever is being read. The About card carries the why. -->
          <p class="flex-1 min-w-0 text-sm font-medium text-white leading-tight">A new version is ready</p>

          <button class="btn-ghost text-xs px-3 py-1.5" @click="dismiss">Later</button>
          <button class="btn-primary text-xs px-3 py-1.5" @click="confirming = true">Update</button>
        </div>
      </div>
    </Transition>

    <ConfirmDialog
      :open="confirming"
      :title="UPDATE_CONFIRM_TITLE"
      :message="UPDATE_CONFIRM_MESSAGE"
      confirm-label="Update and reload"
      cancel-label="Not yet"
      @confirm="applyUpdate"
      @cancel="confirming = false"
    />
  </div>
</template>
