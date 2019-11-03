<template>
    <div class="poker-chip w-auto" @click="chipClicked" :style="offset">
        <img class="w-full" :src="getImage" :alt="amount"/>
    </div>
</template>

<script>
    import GamePlugin from "@/plugins/game/GamePlugin";
    import AudioPlugin from "@/plugins/audio/AudioPlugin";
    import {denominations} from "./denominations";
    let chip = AudioPlugin.load( '/Poker/sounds/chip.mp3');
    let chip2 = AudioPlugin.load('/Poker/sounds/chip2.mp3');
    let chip3 = AudioPlugin.load('/Poker/sounds/chip3.mp3');

    const imagePath = '/Poker/chips/';
    /*class Chip{
          constructor(amount){
              this.amount = amount;
          }

    }*/

    export default {
        name: "Chip",
        props: {
            amount : {
                type: String,
                required: false,
                default: 1
            },
            iteration :{
                type: Number,
                required: false,
                default: 0
            }
        },
        data(){
            return {
               offset: "transform:translateX(-"+(this.iteration * 40)+"px)",
                sounds: [chip, chip2, chip3],
                image: imagePath + '1.svg'
            }
        },
        methods:{
            chipClicked(){
                let cur_sound = Math.floor(Math.random() * Math.floor(this.sounds.length));
                this.sounds[cur_sound].play();
                GamePlugin.events.$emit('chip.add', this.amount);
            },
            split(amount){
                let chips = [];
                denominations.reverse().forEach(function(denomination){
                    while(amount >= denomination  ) {
                        if ( amount > 0 ) {
                            chips.push( new Chip(denomination));
                            amount -= denomination;
                        }
                    }
                });
                return chips;
            }
        },
        computed:{
            getImage(){
                 return  imagePath + this.amount + ".svg"
            }
        }
    }
</script>
