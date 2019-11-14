<template>
	   <div class="text-white">
           <h1 class="text-2xl text-green-500 mb-4">Spotify Account <i class="fab fa-spotify"></i></h1>
           <h2 class="text-3xl mb-4 font-black">{{user_data.display_name}}</h2>
           <img :src="user_data.images[0].url" :alt="user_data.display_name" v-if="user_data.images[0] !== null"/>
           <h3>Email: {{user_data.email}}</h3>
           <a :href="user_data.uri">View Profile <i class="fa fa-eye"></i></a>
           <p>type: {{user_data.type}}</p>

           <inertia-link class="flex items-center group py-5" :href="route('spotify.playlists')">
               <div class="text-white  hover:text-gray-700"><i class="fa fa-list-ul"></i> Playlists</div>
           </inertia-link>

       </div>
</template>

<script>
    export default {
        name: "Profile",
        props: ['user_data']
    }
</script>
