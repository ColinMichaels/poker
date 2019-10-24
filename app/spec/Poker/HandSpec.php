<?php

namespace spec\Poker;

use Poker\Hand;
use PhpSpec\ObjectBehavior;
use Prophecy\Argument;

class HandSpec extends ObjectBehavior
{
    function it_is_initializable()
    {
        $this->shouldHaveType(Hand::class);
    }
}
