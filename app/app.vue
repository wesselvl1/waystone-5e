<template>
  <div class="flex flex-col min-h-screen bg-surface-950">
    <NuxtRouteAnnouncer />
    <NuxtPage />
    <!-- Bottom nav bar -->
    <nav class="fixed bottom-0 inset-x-0 z-50 flex h-16 items-center justify-around border-t border-surface-700/60 bg-surface-900/95 backdrop-blur-sm">
      <NuxtLink
        to="/"
        class="nav-item"
        active-class="nav-item--active"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
        </svg>
        <span>Characters</span>
      </NuxtLink>
      <NuxtLink
        to="/rulepacks"
        class="nav-item"
        active-class="nav-item--active"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <span>Rulepacks</span>
      </NuxtLink>
    </nav>
    <!-- Spacer for bottom nav -->
    <div class="h-16 flex-shrink-0" />
  </div>
</template>

<style>
.nav-item {
  @apply flex flex-col items-center gap-1 text-slate-400 text-[10px] uppercase tracking-wider transition-colors px-6 py-1;
}
.nav-item--active {
  @apply text-primary-400;
}
</style>

