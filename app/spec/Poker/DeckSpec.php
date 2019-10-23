<?php

namespace spec\Poker;

use Poker\Deck;
use PhpSpec\ObjectBehavior;
use Prophecy\Argument;

class DeckSpec extends ObjectBehavior
{
    function it_is_initializable()
    {
        $this->shouldHaveType(Deck::class);
    }

    function it_should_have_four_suits(){
    	$this->suits()->shouldReturn( 4);
    }

    function it_should_have_52_cards(){

    	$this->hasCount()->shouldReturn( 52);
    }
}
