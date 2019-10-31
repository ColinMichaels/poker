<template>
  <div class="p-6 bg-gray-800 min-h-screen flex justify-center items-center">
    <div class="w-full max-w-sm">
      <form class="mt-8 bg-white rounded-lg shadow-lg overflow-hidden" @submit.prevent="submit">
        <div class="px-10 py-12">
            <logo></logo>
            <div class="mx-auto mt-6 w-50 border-b-4" ></div>
          <text-input v-model="form.email" :errors="$page.errors.email" class="mt-10" label="Email" type="email" placeholder="demo@poker.com" autofocus autocapitalize="off" />
          <text-input v-model="form.password" class="mt-6" label="Password"  type="password" placeholder="demo" />
          <label class="mt-6 select-none flex items-center" for="remember">
            <input id="remember" v-model="form.remember" class="mr-1" type="checkbox">
            <span class="text-sm">Remember Me</span>
          </label>
        </div>
        <div class="px-10 py-4 bg-grey-lightest border-t border-grey-lighter flex justify-between items-center">
          <a class="py-2 px-4 bg-red-700 rounded text-white font-black hover:underline hover:bg-red-900 hover:bg-shadow" tabindex="-1" href="#reset-password">Forget password?</a>
          <loading-button :loading="sending" class="bg-green-600 rounded  py-2 px-6 text-white font-black hover:underline hover:bg-green-900 hover:shadow" type="submit">Login &nbsp;<i class="fa fa-forward"></i></loading-button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import LoadingButton from '@/Shared/LoadingButton';
import Logo from '@/Shared/Logo';
import TextInput from '@/Shared/TextInput';

export default {
  metaInfo: { title: 'Login' },
  components: {
    LoadingButton,
    Logo,
    TextInput,
  },
  props: {
    errors: Object,
  },
  data() {
    return {
      sending: false,
      form: {
        email: null,
        password: null,
        remember: null,
      },
    }
  },
  methods: {
    submit() {
      this.sending = true
      this.$inertia.post(this.route('login.attempt'), {
        email: this.form.email,
        password: this.form.password,
        remember: this.form.remember,
      }).then(() => this.sending = false)
    },
  },
}
</script>
