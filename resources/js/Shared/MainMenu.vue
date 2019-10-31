<template>
  <div>
    <div class="mb-4 text-gray-900 p-4 sm:text-white bg-white sm:bg-gray-900 sm:p-0">
      <inertia-link class="flex items-center group py-3" :href="route('home')">
        <div :class="isUrl('home') ? 'text-white' : 'text-gray-500 group-hover:text-white'"><i class="fa fa-home"></i> Start</div>
      </inertia-link>
        <inertia-link class="flex items-center group py-3" :href="route('games.index')">
            <div :class="isUrl('games') ? 'text-white  hover:text-green' : 'text-gray-500'"><i class="fa fa-gamepad"></i> Game</div>
        </inertia-link>
        <inertia-link class="flex items-center group py-3" :href="route('hands.index')">
            <div :class="isUrl('hands') ? 'text-white  hover:text-green' : 'text-gray-500'"><i class="fa fa-gamepad"></i> Hands</div>
        </inertia-link>
        <inertia-link class="flex items-center group py-3" :href="route('howto.index')">
            <div :class="isUrl('howto') ? 'text-white  hover:text-green' : 'text-gray-500'"><i class="fa fa-question-circle"></i> How to</div>
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
