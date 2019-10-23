<?php

namespace spec\Poker;

use Poker\Card;
use PhpSpec\ObjectBehavior;
use Prophecy\Argument;
use Poker\Suit;

class CardSpec extends ObjectBehavior
{

    function it_should_have_one_suit(){

    	$this->suit->shouldReturnAnInstanceOf(Suit::class);

    }

   /* function it_should_return_an_image_path(){

    	$this->image->shouldReturn('/public/Poker/cards/AS.svg');
    }*/

}
