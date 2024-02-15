import { AsanaEvent } from "../interfaces/Asana";
import * as Asana from 'asana';
// const Asana = require('asana');



const TASK_PREFIX_PATTERN = /\[(.+?)\]/;

const registerClient = (): Asana.ApiClient => {
  // console.log('Asana', Asana)
  // return Asana.Client.create().useAccessToken(process.env.ASANA_ACCESS_TOKEN);

  let client = Asana.ApiClient.instance
  let token = client.authentications['token'];
  token.accessToken = process.env.ASANA_ACCESS_TOKEN;

  return client
};

export const createHook = async (projectId: string, url: string) => {
  const client = registerClient();
  // TODO: Add 'added'-only filter to the webhook registration
  const data = {};
  // await client.webhooks.create(projectId, url, data);

  let webhooksApiInstance = new Asana.WebhooksApi();
  let body = {
    "data": {
      resource: projectId,
      target: url,
    }
  };

  let opts = {
    'opt_fields': "active,created_at,filters,filters.action,filters.fields,filters.resource_subtype,last_failure_at,last_failure_content,last_success_at,resource,resource.name,target"
  };
  let result = await webhooksApiInstance.createWebhook(body, opts)
  console.log('API called successfully. Returned data: ' + JSON.stringify(result.data, null, 2));
};

export const handleHook = async (body: { events: AsanaEvent[] }) => {
  const isWatchChangeEvents = process.env.WATCH_CHANGES === "true";
  const isActiveEvent = (x: AsanaEvent) => x.action === "added" || (isWatchChangeEvents && x.action === "changed");
  const filterTaskResource = (x: AsanaEvent) =>
    x.resource.resource_type === "task" && (
      !x.parent 
      || x.parent.resource_type === "project"
      || x.parent.resource_type === "task");

  const activeTasks = body.events
    .filter(isActiveEvent)
    .filter(filterTaskResource);

  console.log('activeTasks', activeTasks)

  if (activeTasks && activeTasks.length) {
    const client = registerClient();
    // let project = await client.projects.findById(process.env.ASANA_PROJECT_ID).data;

    let projectsApiInstance = new Asana.ProjectsApi();
    let project_gid = process.env.ASANA_PROJECT_ID; // String | Globally unique identifier for the project.
    let opts = {
      'opt_fields': "archived,color,completed,completed_at,completed_by,completed_by.name,created_at,created_from_template,created_from_template.name,current_status,current_status.author,current_status.author.name,current_status.color,current_status.created_at,current_status.created_by,current_status.created_by.name,current_status.html_text,current_status.modified_at,current_status.text,current_status.title,current_status_update,current_status_update.resource_subtype,current_status_update.title,custom_field_settings,custom_field_settings.custom_field,custom_field_settings.custom_field.asana_created_field,custom_field_settings.custom_field.created_by,custom_field_settings.custom_field.created_by.name,custom_field_settings.custom_field.currency_code,custom_field_settings.custom_field.custom_label,custom_field_settings.custom_field.custom_label_position,custom_field_settings.custom_field.date_value,custom_field_settings.custom_field.date_value.date,custom_field_settings.custom_field.date_value.date_time,custom_field_settings.custom_field.description,custom_field_settings.custom_field.display_value,custom_field_settings.custom_field.enabled,custom_field_settings.custom_field.enum_options,custom_field_settings.custom_field.enum_options.color,custom_field_settings.custom_field.enum_options.enabled,custom_field_settings.custom_field.enum_options.name,custom_field_settings.custom_field.enum_value,custom_field_settings.custom_field.enum_value.color,custom_field_settings.custom_field.enum_value.enabled,custom_field_settings.custom_field.enum_value.name,custom_field_settings.custom_field.format,custom_field_settings.custom_field.has_notifications_enabled,custom_field_settings.custom_field.is_formula_field,custom_field_settings.custom_field.is_global_to_workspace,custom_field_settings.custom_field.is_value_read_only,custom_field_settings.custom_field.multi_enum_values,custom_field_settings.custom_field.multi_enum_values.color,custom_field_settings.custom_field.multi_enum_values.enabled,custom_field_settings.custom_field.multi_enum_values.name,custom_field_settings.custom_field.name,custom_field_settings.custom_field.number_value,custom_field_settings.custom_field.people_value,custom_field_settings.custom_field.people_value.name,custom_field_settings.custom_field.precision,custom_field_settings.custom_field.resource_subtype,custom_field_settings.custom_field.text_value,custom_field_settings.custom_field.type,custom_field_settings.is_important,custom_field_settings.parent,custom_field_settings.parent.name,custom_field_settings.project,custom_field_settings.project.name,custom_fields,custom_fields.date_value,custom_fields.date_value.date,custom_fields.date_value.date_time,custom_fields.display_value,custom_fields.enabled,custom_fields.enum_options,custom_fields.enum_options.color,custom_fields.enum_options.enabled,custom_fields.enum_options.name,custom_fields.enum_value,custom_fields.enum_value.color,custom_fields.enum_value.enabled,custom_fields.enum_value.name,custom_fields.is_formula_field,custom_fields.multi_enum_values,custom_fields.multi_enum_values.color,custom_fields.multi_enum_values.enabled,custom_fields.multi_enum_values.name,custom_fields.name,custom_fields.number_value,custom_fields.resource_subtype,custom_fields.text_value,custom_fields.type,default_access_level,default_view,due_date,due_on,followers,followers.name,html_notes,icon,members,members.name,minimum_access_level_for_customization,minimum_access_level_for_sharing,modified_at,name,notes,owner,permalink_url,project_brief,public,start_on,team,team.name,workspace,workspace.name"
    };
    let result = await projectsApiInstance.getProject(project_gid, opts)
    let project = result.data

    // console.log('project', project)
    const currentId = await getProjectCurrentId(project);
    // console.log('currentId', currentId)

    let tasksApiInstance = new Asana.TasksApi();
    let updatedId = currentId;
    for (let task of activeTasks) {
      try {
        console.log('to find task.resource.gid', task.resource.gid)
        // const clientTasks = await client.tasks.findAll({ project: process.env.ASANA_PROJECT_ID })
        // console.log('clientTasks', clientTasks)


        let taskOpts = {
          'opt_fields': "actual_time_minutes,approval_status,assignee,assignee.name,assignee_section,assignee_section.name,assignee_status,completed,completed_at,completed_by,completed_by.name,created_at,created_by,custom_fields,custom_fields.asana_created_field,custom_fields.created_by,custom_fields.created_by.name,custom_fields.currency_code,custom_fields.custom_label,custom_fields.custom_label_position,custom_fields.date_value,custom_fields.date_value.date,custom_fields.date_value.date_time,custom_fields.description,custom_fields.display_value,custom_fields.enabled,custom_fields.enum_options,custom_fields.enum_options.color,custom_fields.enum_options.enabled,custom_fields.enum_options.name,custom_fields.enum_value,custom_fields.enum_value.color,custom_fields.enum_value.enabled,custom_fields.enum_value.name,custom_fields.format,custom_fields.has_notifications_enabled,custom_fields.is_formula_field,custom_fields.is_global_to_workspace,custom_fields.is_value_read_only,custom_fields.multi_enum_values,custom_fields.multi_enum_values.color,custom_fields.multi_enum_values.enabled,custom_fields.multi_enum_values.name,custom_fields.name,custom_fields.number_value,custom_fields.people_value,custom_fields.people_value.name,custom_fields.precision,custom_fields.resource_subtype,custom_fields.text_value,custom_fields.type,dependencies,dependents,due_at,due_on,external,external.data,followers,followers.name,hearted,hearts,hearts.user,hearts.user.name,html_notes,is_rendered_as_separator,liked,likes,likes.user,likes.user.name,memberships,memberships.project,memberships.project.name,memberships.section,memberships.section.name,modified_at,name,notes,num_hearts,num_likes,num_subtasks,parent,parent.created_by,parent.name,parent.resource_subtype,permalink_url,projects,projects.name,resource_subtype,start_at,start_on,tags,tags.name,workspace,workspace.name"
        };
        let result = await tasksApiInstance.getTask(task.resource.gid, taskOpts)
        const currentTask = result.data

        // const currentTask = await client.tasks.findById(task.resource.gid)
        console.log('currentTask', `gid:${currentTask.gid}, name:${currentTask.name}`)

        const isTaskPrefixAlreadyExists = !!currentTask.name.match(TASK_PREFIX_PATTERN);
        if (!isTaskPrefixAlreadyExists) {
          updatedId++;
          const name = createUpdatedTaskName(currentTask, updatedId);

          // await client.tasks.update(task.resource.gid, { name });
          let body = { "data": { name } }; // Object | The task to update.
          let result = await tasksApiInstance.updateTask(body, task.resource.gid, taskOpts)

          console.log(`tasksApiInstance.updateTask API called successfully. ${result.data.gid} ${result.data.name}`)
          // console.log('tasksApiInstance.updateTask API called successfully. Returned data: ' + JSON.stringify(result.data, null, 2));
        }
      } catch (error) {
        console.error('An error occurred:', error.text);
        // console.error('An error occurred:', error.text || error);
      }
    }

    if (updatedId > currentId) {
      console.log('Updateing Current Id to', updatedId)
      await setProjectCurrentId(client, updatedId);
    }

    console.log('END CURRENT REQUEST')
  }
};

export const getHooks = async (workspaceId: string) => {
  const client = registerClient();

  let webhooksApiInstance = new Asana.WebhooksApi();

  let opts = {
    'limit': 100,
    'resource': process.env.ASANA_PROJECT_ID,
    'opt_fields': "active,created_at,filters,filters.action,filters.fields,filters.resource_subtype,last_failure_at,last_failure_content,last_success_at,offset,path,resource,resource.name,target,uri"
  };

  // console.log('getHooks find workspaceId', workspaceId)
  const response = await webhooksApiInstance.getWebhooks(workspaceId, opts)
  // console.log('getHooks response', response)

  // const response = await client.webhooks.getAll(workspaceId);
  return response.data;
}

export const deleteHook = async (webhookId: string) => {
  const client = registerClient();

  let webhooksApiInstance = new Asana.WebhooksApi();
  let result = await webhooksApiInstance.deleteWebhook(webhookId)
  console.log('API called successfully. Returned data: ' + JSON.stringify(result.data, null, 2));
}

export const getProjectCurrentId = async (
  project: Asana.resources.Projects.Type
): Promise<number> => {
  const match = project.notes.match(TASK_PREFIX_PATTERN);
  return match ? parseInt(match[1], 10) : 0;
};

export const setProjectCurrentId = async (
  client: Asana.Client,
  id: number,
) => {
  // TODO: Regex update to the existing notes value instead of overwrite
  const notes = `[${id}]`;

  let projectsApiInstance = new Asana.ProjectsApi();
  let body = { "data": {notes} };
  let project_gid = "1331"; // String | Globally unique identifier for the project.
  let opts = {
    'opt_fields': "archived,color,completed,completed_at,completed_by,completed_by.name,created_at,created_from_template,created_from_template.name,current_status,current_status.author,current_status.author.name,current_status.color,current_status.created_at,current_status.created_by,current_status.created_by.name,current_status.html_text,current_status.modified_at,current_status.text,current_status.title,current_status_update,current_status_update.resource_subtype,current_status_update.title,custom_field_settings,custom_field_settings.custom_field,custom_field_settings.custom_field.asana_created_field,custom_field_settings.custom_field.created_by,custom_field_settings.custom_field.created_by.name,custom_field_settings.custom_field.currency_code,custom_field_settings.custom_field.custom_label,custom_field_settings.custom_field.custom_label_position,custom_field_settings.custom_field.date_value,custom_field_settings.custom_field.date_value.date,custom_field_settings.custom_field.date_value.date_time,custom_field_settings.custom_field.description,custom_field_settings.custom_field.display_value,custom_field_settings.custom_field.enabled,custom_field_settings.custom_field.enum_options,custom_field_settings.custom_field.enum_options.color,custom_field_settings.custom_field.enum_options.enabled,custom_field_settings.custom_field.enum_options.name,custom_field_settings.custom_field.enum_value,custom_field_settings.custom_field.enum_value.color,custom_field_settings.custom_field.enum_value.enabled,custom_field_settings.custom_field.enum_value.name,custom_field_settings.custom_field.format,custom_field_settings.custom_field.has_notifications_enabled,custom_field_settings.custom_field.is_formula_field,custom_field_settings.custom_field.is_global_to_workspace,custom_field_settings.custom_field.is_value_read_only,custom_field_settings.custom_field.multi_enum_values,custom_field_settings.custom_field.multi_enum_values.color,custom_field_settings.custom_field.multi_enum_values.enabled,custom_field_settings.custom_field.multi_enum_values.name,custom_field_settings.custom_field.name,custom_field_settings.custom_field.number_value,custom_field_settings.custom_field.people_value,custom_field_settings.custom_field.people_value.name,custom_field_settings.custom_field.precision,custom_field_settings.custom_field.resource_subtype,custom_field_settings.custom_field.text_value,custom_field_settings.custom_field.type,custom_field_settings.is_important,custom_field_settings.parent,custom_field_settings.parent.name,custom_field_settings.project,custom_field_settings.project.name,custom_fields,custom_fields.date_value,custom_fields.date_value.date,custom_fields.date_value.date_time,custom_fields.display_value,custom_fields.enabled,custom_fields.enum_options,custom_fields.enum_options.color,custom_fields.enum_options.enabled,custom_fields.enum_options.name,custom_fields.enum_value,custom_fields.enum_value.color,custom_fields.enum_value.enabled,custom_fields.enum_value.name,custom_fields.is_formula_field,custom_fields.multi_enum_values,custom_fields.multi_enum_values.color,custom_fields.multi_enum_values.enabled,custom_fields.multi_enum_values.name,custom_fields.name,custom_fields.number_value,custom_fields.resource_subtype,custom_fields.text_value,custom_fields.type,default_access_level,default_view,due_date,due_on,followers,followers.name,html_notes,icon,members,members.name,minimum_access_level_for_customization,minimum_access_level_for_sharing,modified_at,name,notes,owner,permalink_url,project_brief,public,start_on,team,team.name,workspace,workspace.name"
  };
  let result = await projectsApiInstance.updateProject(body, process.env.ASANA_PROJECT_ID, opts)
  console.log('API called successfully. Returned data: ' + JSON.stringify(result.data, null, 2));
  
  // await client.projects.update(process.env.ASANA_PROJECT_ID, { notes });
};

export const createUpdatedTaskName = (
  currentTask: Asana.resources.Tasks.Type,
  updatedId: number,
): string => {
  const taskPrefix = `[${process.env.ASANA_PROJECT_PREFIX}-${updatedId}]`;
  return `${taskPrefix} ${currentTask.name}`;
};
