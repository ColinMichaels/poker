<template>
    <div class="avatars flex mt-10 -mb-10">
        <hooper :settings="settings" class="select-none focus:outline-none focus:shadow-none" >
            <slide v-for="avatar in avatars"
                   v-bind:name="avatar.name"
                   v-bind:key="avatar.name"
                   v-bind:selected="selected">
                <avatar :name="avatar.name" :bgcolor="avatar.bgcolor" :sound="avatar.sound" @click.once="selectAvatar(avatar)"></avatar>
            </slide>
        </hooper>
    </div>
</template>

<script>
    import { Hooper, Slide } from 'hooper';
    import 'hooper/dist/hooper.css';
    import Avatar from "@/components/shared/Avatar";
    export default {
        name: "AvatarSlider",
        data(){
            return{
                settings:{
                    itemsToShow: 3,
                    infiniteScroll : true,
                    autoPlay: true,
                    breakpoints:{
                        1200:{
                           itemsToShow: 8,
                        },
                        1000:{
                            itemsToShow: 5,
                        },
                        800:{
                            itemsToShow: 4
                        },
                        475:{
                            itemsToShow : 3
                        }
                    }
                },
                selected: null,
                avatars : [
                        {
                            name: 'robot-03',
                            sound: 'robot-2',
                            bgcolor: 'bg-yellow-400'
                        },
                        {
                            name: 'batman',
                            sound: 'im-batman',
                            bgcolor: 'bg-black'
                        },
                        {
                            name: 'robot-01',
                            sound: 'robot-blip',
                            bgcolor: 'bg-blue-400'
                        },
                        {
                            name: 'robot-02',
                            sound: 'robot-2',
                            bgcolor: 'bg-red-600'
                        },
                        {
                            name: 'charlie-chaplin',
                            sound: 'cha-ching',
                            bgcolor: 'bg-gray-400'
                        },
                    {
                        name: 'dalai-lama',
                        sound: 'cha-ching',
                        bgcolor: 'bg-gray-400'
                    },
                    {
                        name: 'dave-grohl',
                        sound: 'cha-ching',
                        bgcolor: 'bg-gray-400'
                    },
                    {
                        name: 'nikola-tesla',
                        sound: 'cha-ching',
                        bgcolor: 'bg-gray-400'
                    },
                    {
                        name: 'donald-trump',
                        sound: 'we_have_losers',
                        bgcolor: 'bg-white'
                    },
                    {
                        name: 'player_02',
                        bgcolor: 'bg-green-600'
                    },
                    {
                        name: 'player_f_01',
                        bgcolor: 'bg-pink-600'
                    },
                ]
            }
        },
        methods:{
          selectAvatar(avatar){
              console.log(avatar);
              this.selected = 1;
          }
        },
        components: {
            Hooper,
            Slide,
            Avatar
        }
    }
</script>
