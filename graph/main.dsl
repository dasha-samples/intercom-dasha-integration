import "commonReactions/all.dsl";

context
{
    input conversationId: string;
    input continueConversation: boolean;
    last_message: string = "";
    can_say: boolean = false;
    output status: string?;
    output serviceStatus: string?;
}

external function send_report_on_manager(report: string): unknown;


//nodes 
start node root
{
    do
    {
        #connectSafe("");
  //      if(!$continueConversation)
        {
            #say("greeting", repeatMode: "ignore");
            #say("how_can_i_help_you");
        }
        goto hub;
    }
    transitions
    {
        hub: goto hub;
    }
}

node hub
{
    do
    {
        digression enable hello;
        
        if($can_say)
        {
            #say("how_can_i_help_you_again");
        }
        
        set $can_say = true;
        wait *;
    }
    transitions
    {
        problem: goto problem on #messageHasIntent("have_problem") priority 100;
    }
}

node problem
{
    do
    {
        #say("describe_problem");
        digression disable hello;
        wait *;
    }
    transitions
    {
        problem_with_phone: goto problem_with_phone on #messageHasIntent("problem_with_phone");
        problem_with_manager: goto problem_with_manager on #messageHasIntent("problem_with_manager");
    }
    onexit
    {
        problem_with_manager:
        do
        {
            set $last_message = #getMessageText();
        }
    }
}

node problem_with_manager
{
    do
    {
        #say("problem_with_manager");
        external send_report_on_manager($last_message);
        digression enable problem_dig;
        goto hub;
    }
    transitions
    {
        hub: goto hub;
    }
}

node problem_with_phone
{
    do
    {
        #say("problem_with_phone");
        digression enable problem_dig;
        goto hub;
    }
    transitions
    {
        hub: goto hub;
    }
}

// digressions
digression what_can_you_do
{
    conditions
    {
        on #messageHasIntent("what_can_you_do");
    }
    do
    {
        {
            #say("i_can_do", repeatMode: "ignore");
        }
        #repeat();
        return;
    }
    transitions
    {
    }
}

digression who_are_you
{
    conditions
    {
        on #messageHasIntent("who_are_you");
    }
    do
    {

            #say("who_are_you");
        return;
    }
    transitions
    {
    }
}

digression problem_dig
{
    conditions
    {
        on #messageHasAnyIntent(["problem_with_phone", "problem_with_manager", "have_problem"]);
    }
    do
    {
        digression disable problem_dig;
        goto problem;
    }
    transitions
    {
        problem: goto problem;
    }
}

digression hello
{
    conditions
    {
        on #messageHasIntent("hello");
    }
    do
    {
        #say("hello", repeatMode:"ignore");
        
        digression disable hello;
        return;
    }
    transitions
    {
    }
}