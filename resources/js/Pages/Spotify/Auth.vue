<template>
	     <div>
             <div class="flex flex-col justify-center p-4 text-center w-1/2 mx-auto">
                 <h2 class="text-2xl text-white my-4 text-center font-bold">Login to <span class="text-green-500 font-medium"><i class="fab fa-spotify"></i> Spotify</span></h2>
                 <p class="text-white font-mono">Listen while you play!</p>
                 <form @submit.prevent="login" class="flex flex-col ">
                     <a class="rounded-lg p-4 bg-green-600 text-white my-4 font-bold hover:bg-green-700" target="_parent" :href="login_url">Login</a>
                     <p v-if="error" class="text-red-500">Bad login information</p>
                 </form>
             </div>
         </div>
</template>

<script>
    export default {
        name: "Auth",
        data() {
            return {
                error: false
            }
        },
        props: ['login_url'],
        methods: {
            login () {
                this.$inertia.reload('/spotify/auth/edit');
            }
        }
    }
</script>
