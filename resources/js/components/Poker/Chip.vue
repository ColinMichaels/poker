<template>
    <div class="poker-chip w-20 h-20" @click="flip" :style="offset">
        <img class="w-full" :src="image" :alt="amount"/>
    </div>
</template>

<script>
    import {Howl} from 'howler';
    import {denominations} from "./denominations";
    let chip = new Howl({
        src : [ '/Poker/sounds/chip.mp3' ]
    });
    let chip2 = new Howl({
        src: ['/Poker/sounds/chip2.mp3']
    });
    let chip3 = new Howl({
        src: ['/Poker/sounds/chip3.mp3']
    });

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
            flip(){
                let cur_sound = Math.floor(Math.random() * Math.floor(this.sounds.length));
                this.sounds[cur_sound].play();
            },
            getImage(){
                this.image  =  imagePath + this.amount + ".svg"
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
        mounted(){
            this.getImage();
        }
    }
</script>
