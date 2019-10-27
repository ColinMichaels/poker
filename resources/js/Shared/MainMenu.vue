<template>
  <div>
    <div class="mb-4">
      <inertia-link class="flex items-center group py-3" :href="route('home')">
        <div :class="isUrl('home') ? 'text-white' : 'text-blue-500 group-hover:text-white'"><i class="fa fa-home"></i> Dashboard</div>
      </inertia-link>
        <inertia-link class="flex items-center group py-3" :href="route('games.index')">
            <div :class="isUrl('games') ? 'text-white  hover:text-green' : 'text-blue-500 group-hover:text-white'"><i class="fa fa-gamepad"></i> Game</div>
        </inertia-link>
    </div>
  </div>
</template>

<script>
import Icon from '@/Shared/Icon'

export default {
  components: {
    Icon,
  },
  props: {
    url: String,
  },
  methods: {
    isUrl(...urls) {
      if (urls[0] === '') {
        return this.url === ''
      }

      return urls.filter(url => this.url.startsWith(url)).length
    },
  },
}
</script>
