<template>
        <transition name="slideInLeft">
            <div class="animated bg-gray-800 h-screen w-auto h-full p-4" :class="animation">

                <button @click="toggle" class="bg-blue-800 text-2xl text-white py-2 px-5 rounded"><i class="fa fa-caret-left"></i></button>
            <div class="search-menu">
                <label for="search"><i class="fa fa-search text-white"></i></label>
                <input id="search" type="text" name="search" value="Search"/>
            </div>
                <ul class="list-none">
                   <li v-for="item in items" class="py-2 text-white">
                       <a href="#">{{ item }}</a>
                   </li>
                </ul>
            </div>
        </transition>
</template>

<script>

    export default {
        name: "SidebarMenu",
        props: ['items'],
        components:{

        },
        data(){
            return{
                visible: true ,
                animation : ''
            }
        },
        methods:{
            toggle(){
                this.visible = !this.visible;
                this.animation = (this.visible)?'slideInLeft' : 'slideOutLeft';
            },
        }
    }
</script>
